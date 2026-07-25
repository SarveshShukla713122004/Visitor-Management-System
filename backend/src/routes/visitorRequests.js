import express from 'express';
import { nanoid } from 'nanoid';
import VisitorRequest from '../models/VisitorRequest.js';
import User from '../models/User.js';
import Blacklist from '../models/Blacklist.js';
import Notification from '../models/Notification.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHONE_REGEX = /^[6-9]\d{9}$/;  // 10-digit Indian mobile
const AADHAAR_REGEX = /^\d{12}$/;     // 12-digit Aadhaar

// Mask Aadhaar: show only last 4 digits
const maskAadhaar = (aadhaar) => {
  if (!aadhaar) return '';
  const clean = aadhaar.replace(/\D/g, '');
  return clean.length >= 4 ? 'XXXX-XXXX-' + clean.slice(-4) : '****';
};

// Strip Aadhaar masking from response objects
const sanitizeRequest = (req) => {
  const obj = req.toObject ? req.toObject() : { ...req };
  if (obj.aadhaar) obj.aadhaar = maskAadhaar(obj.aadhaar);
  return obj;
};

// Create in-app notification
const notify = async ({ recipientId, type, title, body, relatedRequest }) => {
  try {
    await Notification.create({ recipient: recipientId, type, title, body, relatedRequest });
  } catch (e) { console.error('Notification error:', e.message); }
};

// Check if visitor is on blacklist
const checkBlacklist = async (phone, aadhaar) => {
  const cleanPhone = phone?.replace(/\D/g, '').slice(-10);
  const cleanAadhaar = aadhaar?.replace(/\D/g, '');

  const orConditions = [];
  if (cleanPhone) {
    orConditions.push({ phone: { $regex: cleanPhone } });
    orConditions.push({ idNumber: { $regex: cleanPhone } });
  }
  if (cleanAadhaar) {
    orConditions.push({ aadhaar: cleanAadhaar });
    orConditions.push({ idNumber: cleanAadhaar });
  }

  if (orConditions.length === 0) return null;

  return Blacklist.findOne({ $or: orConditions, isActive: true });
};

// Helper: Get all departments an HOD has authority over (own dept + leave delegation)
const getAuthorizedDepartmentsForHOD = async (user) => {
  const depts = [user.department];
  if (!user.department) return depts;
  const delegatedHODs = await User.find({ delegateHOD: user._id, role: 'HOD', active: true });
  delegatedHODs.forEach(h => {
    if (h.department && !depts.includes(h.department)) {
      depts.push(h.department);
    }
  });
  return depts;
};

// Get populated visitor request
const populateReq = (q) =>
  q.populate('submittedBy', 'name email department')
   .populate('hodAssigned', 'name email department')
   .populate('checkedInBy', 'name role')
   .populate('checkedOutBy', 'name role')
   .populate('history.performedBy', 'name role');

// ─── GET Routes ───────────────────────────────────────────────────────────────

// GET /api/requests — role-scoped list
router.get('/', protect, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filter = {};

    // Role-based scoping
    if (req.user.role === 'Employee') {
      filter.submittedBy = req.user._id;
    } else if (req.user.role === 'HOD') {
      const depts = await getAuthorizedDepartmentsForHOD(req.user);
      filter.department = { $in: depts };
    } else if (req.user.role === 'Security') {
      filter.status = { $in: ['HOD Approved', 'Checked-In', 'Blacklist Flagged'] };
    }
    // Admin sees all

    if (status && status !== 'all') filter.status = status;

    // Search by visitor name or phone
    if (search) {
      filter.$or = [
        { visitorName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await VisitorRequest.countDocuments(filter);
    const requests = await populateReq(
      VisitorRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
    );

    // Mask Aadhaar on all records
    const sanitized = requests.map(r => sanitizeRequest(r));

    res.json({ success: true, requests: sanitized, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return serverError(res, err); }
});

// GET /api/requests/checked-in — Security: live currently checked-in list
router.get('/checked-in', protect, authorize('Security', 'Admin'), async (req, res) => {
  try {
    const requests = await populateReq(
      VisitorRequest.find({ status: 'Checked-In' }).sort({ checkInTime: 1 })
    );
    const sanitized = requests.map(r => sanitizeRequest(r));
    res.json({ success: true, requests: sanitized });
  } catch (err) { return serverError(res, err); }
});

// GET /api/requests/autofill?phone=XXX — Employee: recurring visitor lookup
router.get('/autofill', protect, authorize('Employee'), async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || phone.length < 6) return res.json({ success: true, visitor: null });

    const recent = await VisitorRequest.findOne({ phone: { $regex: phone.replace(/\D/g, '') } })
      .sort({ createdAt: -1 })
      .select('visitorName company aadhaar phone');

    if (!recent) return res.json({ success: true, visitor: null });

    res.json({
      success: true,
      visitor: {
        visitorName: recent.visitorName,
        company: recent.company,
        phone: recent.phone,
        aadhaar: maskAadhaar(recent.aadhaar),
      },
    });
  } catch (err) { return serverError(res, err); }
});

// GET /api/requests/:id — single request with history
router.get('/:id', protect, async (req, res) => {
  try {
    const request = await populateReq(VisitorRequest.findById(req.params.id));
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    // Access control
    if (req.user.role === 'Employee' && String(request.submittedBy._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'HOD' && request.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, request: sanitizeRequest(request) });
  } catch (err) { return serverError(res, err); }
});

// GET /api/requests/:id/gatepass — Security: get data for PDF generation
router.get('/:id/gatepass', protect, authorize('Security', 'Admin'), async (req, res) => {
  try {
    const request = await populateReq(VisitorRequest.findById(req.params.id));
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!['HOD Approved', 'Checked-In'].includes(request.status) && !request.gatePassGenerated) {
      return res.status(400).json({ success: false, message: 'Gate pass not available for this request.' });
    }

    res.json({
      success: true,
      gatePass: {
        id: request._id,
        gatePassId: request.gatePassId,
        visitorName: request.visitorName,
        company: request.company,
        purpose: request.purpose,
        phone: request.phone,
        department: request.department,
        hostName: request.submittedBy?.name || 'N/A',
        status: request.status,
        visitDate: request.visitDate || request.createdAt,
        gatePassExpiry: request.gatePassExpiry,
        photoBase64: request.photoBase64,
      },
    });
  } catch (err) { return serverError(res, err); }
});

// ─── POST Routes ──────────────────────────────────────────────────────────────

// POST /api/requests — Employee submits new visitor request
router.post('/', protect, authorize('Employee'), async (req, res) => {
  try {
    const { visitorName, company, purpose, phone, aadhaar, photoBase64, requestType, visitDate, startDate, endDate } = req.body;

    // Validation
    const errors = [];
    if (!visitorName?.trim()) errors.push('Visitor name is required.');
    if (!purpose) errors.push('Purpose is required.');
    if (!phone) errors.push('Phone number is required.');

    const cleanPhone = phone?.replace(/\D/g, '');
    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      errors.push('Phone must be a valid 10-digit Indian mobile number (starts with 6-9).');
    }

    if (aadhaar) {
      const cleanAadhaar = aadhaar.replace(/\D/g, '');
      if (!AADHAAR_REGEX.test(cleanAadhaar)) {
        errors.push('Aadhaar must be exactly 12 digits.');
      }
    }

    if (photoBase64) {
      // Rough base64 size check: ~0.75 bytes per char
      const sizeBytes = (photoBase64.length * 3) / 4;
      if (sizeBytes > 2 * 1024 * 1024) {
        errors.push('Photo must be under 2MB. Please compress or resize the image.');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    // Find HOD for employee's department
    const hodUser = await User.findOne({ role: 'HOD', department: req.user.department, active: true });

    const requestDoc = await VisitorRequest.create({
      visitorName: visitorName.trim(),
      company:     company?.trim(),
      purpose,
      phone:       cleanPhone,
      aadhaar:     aadhaar ? aadhaar.replace(/\D/g, '') : undefined,
      photoBase64,
      department:  req.user.department,
      submittedBy: req.user._id,
      hodAssigned: hodUser?._id,
      requestType: requestType || 'single-visit',
      visitDate:   visitDate ? new Date(visitDate) : new Date(),
      startDate:   startDate ? new Date(startDate) : undefined,
      endDate:     endDate ? new Date(endDate) : undefined,
      history: [{
        action:          'Request Submitted',
        performedBy:     req.user._id,
        performedByName: req.user.name,
        performedByRole: 'Employee',
        note:            `Visitor request submitted for ${visitorName}`,
      }],
    });

    // Notify HOD & Delegate HOD if set
    if (hodUser) {
      const recipientIds = [hodUser._id];
      if (hodUser.delegateHOD) recipientIds.push(hodUser.delegateHOD);

      for (const recipientId of recipientIds) {
        await notify({
          recipientId,
          type:           'new_request',
          title:          `New Visitor Request — ${visitorName}`,
          body:           `${req.user.name} submitted a visitor request for ${visitorName} (${company || 'N/A'}) — ${purpose}.`,
          relatedRequest: requestDoc._id,
        });
        req.app.get('io')?.to(`user:${recipientId}`).emit('new_request', { requestId: requestDoc._id });
      }
    }

    await logAudit({ actor: req.user, action: 'SUBMIT_VISITOR_REQUEST', targetType: 'VisitorRequest', targetId: requestDoc._id, details: { visitorName, purpose }, req });

    res.status(201).json({ success: true, request: sanitizeRequest(requestDoc) });
  } catch (err) { return serverError(res, err); }
});

// ─── PUT Routes ───────────────────────────────────────────────────────────────

// PUT /api/requests/:id/hod-approve — HOD approves request
router.put('/:id/hod-approve', protect, authorize('HOD'), async (req, res) => {
  try {
    const request = await VisitorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    // Scope check: HOD can approve requests from their own department or delegated department
    const depts = await getAuthorizedDepartmentsForHOD(req.user);
    if (!depts.includes(request.department)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to approve requests for this department.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Cannot approve a request with status '${request.status}'.` });
    }

    // Auto-blacklist check before forwarding to Security
    const hit = await checkBlacklist(request.phone, request.aadhaar);

    const newStatus = hit ? 'Blacklist Flagged' : 'HOD Approved';
    const gatePassId = nanoid(10).toUpperCase();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    request.status = newStatus;
    request.gatePassId = gatePassId;
    request.gatePassExpiry = endOfDay;
    if (hit) {
      request.blacklistFlag = true;
      request.blacklistReason = hit.reason;
    }

    request.history.push({
      action:          'HOD Approved',
      performedBy:     req.user._id,
      performedByName: req.user.name,
      performedByRole: 'HOD',
      note:            hit ? `⚠️ Blacklist hit: ${hit.reason}` : 'Approved and forwarded to Security.',
    });

    await request.save();

    // Notify Employee
    await notify({
      recipientId:    request.submittedBy,
      type:           'hod_approved',
      title:          hit ? `⚠️ Blacklist Flag — ${request.visitorName}` : `✅ Request Approved — ${request.visitorName}`,
      body:           hit
        ? `Your visitor request was approved by HOD but flagged on the blacklist. Admin review required.`
        : `Your visitor request for ${request.visitorName} has been approved. Security will verify and check in.`,
      relatedRequest: request._id,
    });

    // Notify Security (if not blacklist flagged)
    if (!hit) {
      const securityOfficers = await User.find({ role: 'Security', active: true });
      for (const sec of securityOfficers) {
        await notify({
          recipientId:    sec._id,
          type:           'hod_approved',
          title:          `Visitor Approved — ${request.visitorName}`,
          body:           `HOD has approved ${request.visitorName}'s visit. Awaiting Security verification.`,
          relatedRequest: request._id,
        });
        req.app.get('io')?.to(`user:${sec._id}`).emit('hod_approved', { requestId: request._id });
      }
    } else {
      // Notify Admin about blacklist flag
      const admins = await User.find({ role: 'Admin', active: true });
      for (const admin of admins) {
        await notify({
          recipientId:    admin._id,
          type:           'blacklist_flag',
          title:          `🚫 Blacklist Flag — ${request.visitorName}`,
          body:           `Visitor ${request.visitorName} matched blacklist entry. Reason: ${hit.reason}. Admin review required.`,
          relatedRequest: request._id,
        });
      }
    }

    // Emit to employee
    req.app.get('io')?.to(`user:${request.submittedBy}`).emit('status_update', { requestId: request._id, status: newStatus });

    await logAudit({ actor: req.user, action: 'HOD_APPROVED', targetType: 'VisitorRequest', targetId: request._id, details: { blacklistHit: !!hit }, req });

    res.json({ success: true, request: sanitizeRequest(request), blacklistHit: !!hit });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/requests/:id/hod-reject — HOD rejects with mandatory reason
router.put('/:id/hod-reject', protect, authorize('HOD'), async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory.' });
    }

    const request = await VisitorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    const depts = await getAuthorizedDepartmentsForHOD(req.user);
    if (!depts.includes(request.department)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to reject requests for this department.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Cannot reject a request with status '${request.status}'.` });
    }

    request.status = 'HOD Rejected';
    request.rejectionReason = reason.trim();
    request.history.push({
      action:          'HOD Rejected',
      performedBy:     req.user._id,
      performedByName: req.user.name,
      performedByRole: 'HOD',
      note:            reason.trim(),
    });
    await request.save();

    // Notify Employee with rejection reason
    await notify({
      recipientId:    request.submittedBy,
      type:           'hod_rejected',
      title:          `❌ Request Rejected — ${request.visitorName}`,
      body:           `Your visitor request for ${request.visitorName} was rejected by HOD. Reason: ${reason.trim()}`,
      relatedRequest: request._id,
    });

    req.app.get('io')?.to(`user:${request.submittedBy}`).emit('status_update', { requestId: request._id, status: 'HOD Rejected' });
    await logAudit({ actor: req.user, action: 'HOD_REJECTED', targetType: 'VisitorRequest', targetId: request._id, details: { reason }, req });

    res.json({ success: true, request: sanitizeRequest(request) });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/requests/:id/checkin — Security verifies and checks in
router.put('/:id/checkin', protect, authorize('Security'), async (req, res) => {
  try {
    const request = await VisitorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (!['HOD Approved'].includes(request.status)) {
      return res.status(400).json({ success: false, message: `Cannot check in a request with status '${request.status}'.` });
    }

    if (request.blacklistFlag) {
      return res.status(400).json({ success: false, message: 'This request is blacklist-flagged. Admin must review before check-in.' });
    }

    // Live blacklist re-check before allowing entry
    const hit = await checkBlacklist(request.phone, request.aadhaar);
    if (hit) {
      request.status = 'Blacklist Flagged';
      request.blacklistFlag = true;
      request.blacklistReason = hit.reason;
      request.history.push({
        action: 'Blacklist Hit During Check-In',
        performedBy: req.user._id,
        performedByName: req.user.name,
        performedByRole: 'Security',
        note: `⚠️ Live Security check-in blocked! Visitor matched active blacklist entry: ${hit.reason}`,
      });
      await request.save();

      // Notify Admins
      const admins = await User.find({ role: 'Admin', active: true });
      for (const admin of admins) {
        await notify({
          recipientId: admin._id,
          type: 'blacklist_flag',
          title: `🚫 Check-In Blocked — ${request.visitorName}`,
          body: `Security check-in blocked! ${request.visitorName} matched active blacklist. Reason: ${hit.reason}.`,
          relatedRequest: request._id,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Check-in blocked! Visitor matched active security blacklist entry: "${hit.reason}". Request forwarded to Admin for review.`,
      });
    }

    request.status = 'Checked-In';
    request.checkInTime = new Date();
    request.checkedInBy = req.user._id;
    request.gatePassGenerated = true;

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    request.gatePassExpiry = endOfDay;

    request.history.push({
      action:          'Checked-In',
      performedBy:     req.user._id,
      performedByName: req.user.name,
      performedByRole: 'Security',
      note:            'Physical ID verified. Gate pass generated.',
    });
    await request.save();

    // Notify Employee
    await notify({
      recipientId:    request.submittedBy,
      type:           'checked_in',
      title:          `🟢 Visitor Checked In — ${request.visitorName}`,
      body:           `${request.visitorName} has been checked in by Security. Gate pass is active.`,
      relatedRequest: request._id,
    });

    req.app.get('io')?.to(`user:${request.submittedBy}`).emit('status_update', { requestId: request._id, status: 'Checked-In' });
    req.app.get('io')?.emit('checkin_update'); // Broadcast to all Security

    await logAudit({ actor: req.user, action: 'SECURITY_CHECKIN', targetType: 'VisitorRequest', targetId: request._id, details: { visitorName: request.visitorName }, req });

    res.json({ success: true, request: sanitizeRequest(request) });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/requests/:id/checkout — Security checks visitor out
router.put('/:id/checkout', protect, authorize('Security'), async (req, res) => {
  try {
    const request = await VisitorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (request.status !== 'Checked-In') {
      return res.status(400).json({ success: false, message: 'Visitor is not currently checked in.' });
    }

    request.status = 'Checked-Out';
    request.checkOutTime = new Date();
    request.checkedOutBy = req.user._id;
    request.history.push({
      action:          'Checked-Out',
      performedBy:     req.user._id,
      performedByName: req.user.name,
      performedByRole: 'Security',
      note:            'Visitor exited campus. Gate pass closed.',
    });
    await request.save();

    req.app.get('io')?.emit('checkout_update'); // Broadcast to all Security
    await logAudit({ actor: req.user, action: 'SECURITY_CHECKOUT', targetType: 'VisitorRequest', targetId: request._id, details: { visitorName: request.visitorName }, req });

    res.json({ success: true, request: sanitizeRequest(request) });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/requests/:id/admin-override — Admin resolves blacklist-flagged requests
router.put('/:id/admin-override', protect, authorize('Admin'), async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!['clear-flag', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be clear-flag or reject.' });
    }

    const request = await VisitorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (action === 'clear-flag') {
      request.status = 'HOD Approved';
      request.blacklistFlag = false;
      request.blacklistReason = undefined;
      request.history.push({
        action:          'Admin Cleared Blacklist Flag',
        performedBy:     req.user._id,
        performedByName: req.user.name,
        performedByRole: 'Admin',
        note:            note || 'Blacklist flag cleared. Forwarded to Security.',
      });
    } else {
      request.status = 'HOD Rejected';
      request.rejectionReason = note || 'Admin rejected due to blacklist flag.';
      request.history.push({
        action:          'Admin Rejected (Blacklist)',
        performedBy:     req.user._id,
        performedByName: req.user.name,
        performedByRole: 'Admin',
        note:            request.rejectionReason,
      });
    }

    await request.save();
    await logAudit({ actor: req.user, action: `ADMIN_OVERRIDE_${action.toUpperCase()}`, targetType: 'VisitorRequest', targetId: request._id, details: { note }, req });
    res.json({ success: true, request: sanitizeRequest(request) });
  } catch (err) { return serverError(res, err); }
});

export default router;
