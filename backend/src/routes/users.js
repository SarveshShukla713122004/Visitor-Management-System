import express from 'express';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// GET /api/users — Admin: all users; HOD: employees in their dept; others: self only
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Admin') {
      // Admin sees all
    } else if (req.user.role === 'HOD') {
      // HOD sees employees in their department
      query = { role: 'Employee', department: req.user.department };
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const users = await User.find(query).select('-password').sort({ name: 1 });
    res.json({ success: true, users });
  } catch (err) { return serverError(res, err); }
});

// GET /api/users/hods — list all HODs with their departments
router.get('/hods', protect, async (req, res) => {
  try {
    const hods = await User.find({ role: 'HOD', active: true })
      .select('name email department phone avatarColor delegateHOD')
      .populate('delegateHOD', 'name email')
      .sort({ department: 1 });
    res.json({ success: true, hods });
  } catch (err) { return serverError(res, err); }
});

// GET /api/users/departments — unique departments list (from HODs)
router.get('/departments', protect, async (req, res) => {
  try {
    const hods = await User.find({ role: 'HOD', active: true }).select('department name');
    const departments = hods.map(h => ({ department: h.department, hod: h.name }));
    res.json({ success: true, departments });
  } catch (err) { return serverError(res, err); }
});

// POST /api/users — Admin creates user (no public registration)
router.post('/', protect, authorize('Admin'), async (req, res) => {
  try {
    const { name, email, password, role, department, phone, employeeId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });
    }

    // Validate email format
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }

    // Enforce minimum password strength (8+ chars, upper, lower, digit)
    const PWD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!PWD_RE.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
      });
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // HOD constraint: one HOD per department
    if (role === 'HOD') {
      if (!department) {
        return res.status(400).json({ success: false, message: 'Department is required for HOD accounts.' });
      }
      const existingHOD = await User.findOne({ role: 'HOD', department, active: true });
      if (existingHOD) {
        return res.status(400).json({
          success: false,
          message: `Department '${department}' already has an active HOD: ${existingHOD.name}. Deactivate them first or assign a different department.`,
        });
      }
    }

    // Employee warning: check if department has an HOD
    if (role === 'Employee' && department) {
      const deptHOD = await User.findOne({ role: 'HOD', department, active: true });
      if (!deptHOD) {
        // Not blocking — just a warning in response
        const user = await User.create({ name, email, password, role, department, phone, employeeId });
        await logAudit({ actor: req.user, action: 'CREATE_USER', targetType: 'User', targetId: user._id, details: { name, role, department }, req });
        return res.status(201).json({
          success: true,
          user: { ...user.toObject(), password: undefined },
          warning: `Department '${department}' has no assigned HOD. Visitor requests from this employee cannot be approved until an HOD is assigned.`,
        });
      }
    }

    const user = await User.create({ name, email, password, role, department, phone, employeeId });
    await logAudit({ actor: req.user, action: 'CREATE_USER', targetType: 'User', targetId: user._id, details: { name, role, department }, req });
    res.status(201).json({ success: true, user: { ...user.toObject(), password: undefined } });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/users/:id — Admin edits user
router.put('/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const { password, ...updates } = req.body;

    // If changing to HOD, check department constraint
    if (updates.role === 'HOD' && updates.department) {
      const existingHOD = await User.findOne({ role: 'HOD', department: updates.department, active: true, _id: { $ne: req.params.id } });
      if (existingHOD) {
        return res.status(400).json({
          success: false,
          message: `Department '${updates.department}' already has an active HOD: ${existingHOD.name}.`,
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await logAudit({ actor: req.user, action: 'UPDATE_USER', targetType: 'User', targetId: user._id, details: updates, req });
    res.json({ success: true, user });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/users/:id/deactivate — Admin soft-deactivates
router.put('/:id/deactivate', protect, authorize('Admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await logAudit({ actor: req.user, action: 'DEACTIVATE_USER', targetType: 'User', targetId: user._id, details: { name: user.name }, req });
    res.json({ success: true, user });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/users/:id/reactivate — Admin reactivates
router.put('/:id/reactivate', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { active: true }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await logAudit({ actor: req.user, action: 'REACTIVATE_USER', targetType: 'User', targetId: user._id, details: { name: user.name }, req });
    res.json({ success: true, user });
  } catch (err) { return serverError(res, err); }
});

// DELETE /api/users/:id — Admin hard delete (use deactivate instead for production)
router.delete('/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await logAudit({ actor: req.user, action: 'DELETE_USER', targetType: 'User', targetId: req.params.id, details: { name: user.name }, req });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { return serverError(res, err); }
});

export default router;
