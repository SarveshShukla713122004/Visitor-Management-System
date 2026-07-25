import express from 'express';
import Blacklist from '../models/Blacklist.js';
import VisitorRequest from '../models/VisitorRequest.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// GET /api/blacklist — list entries (all authenticated roles)
router.get('/', protect, async (req, res) => {
  try {
    const list = await Blacklist.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('addedBy', 'name role');
    res.json({ success: true, blacklist: list });
  } catch (err) { return serverError(res, err); }
});

// GET /api/blacklist/flagged — Admin: requests currently flagged by blacklist
router.get('/flagged', protect, authorize('Admin'), async (req, res) => {
  try {
    const flagged = await VisitorRequest.find({ blacklistFlag: true, status: 'Blacklist Flagged' })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'name email department')
      .populate('hodAssigned', 'name');
    res.json({ success: true, requests: flagged });
  } catch (err) { return serverError(res, err); }
});

// POST /api/blacklist — Admin adds entry
router.post('/', protect, authorize('Admin'), async (req, res) => {
  try {
    const { name, phone, aadhaar, idNumber, reason, severity } = req.body;

    if (!name?.trim() || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Name and reason are required.' });
    }

    // Validate Aadhaar if provided
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\D/g, ''))) {
      return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits.' });
    }

    const entry = await Blacklist.create({
      name:     name.trim(),
      phone:    phone?.replace(/\D/g, '') || undefined,
      aadhaar:  aadhaar?.replace(/\D/g, '') || undefined,
      idNumber: idNumber?.trim() || undefined,
      reason:   reason.trim(),
      severity: severity || 'Medium',
      addedBy:  req.user._id,
    });

    await logAudit({ actor: req.user, action: 'ADD_TO_BLACKLIST', targetType: 'Blacklist', targetId: entry._id, details: { name, reason }, req });
    res.status(201).json({ success: true, entry });
  } catch (err) { return serverError(res, err); }
});

// DELETE /api/blacklist/:id — Admin removes entry (soft delete)
router.delete('/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const entry = await Blacklist.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.' });
    await logAudit({ actor: req.user, action: 'REMOVE_FROM_BLACKLIST', targetType: 'Blacklist', targetId: entry._id, details: { name: entry.name }, req });
    res.json({ success: true, message: 'Removed from blacklist.' });
  } catch (err) { return serverError(res, err); }
});

export default router;
