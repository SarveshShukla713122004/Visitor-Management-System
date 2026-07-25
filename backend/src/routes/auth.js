import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

import { logAudit } from '../middleware/auditLogger.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Brute-force protection: Check if account is locked
    if (user.isLocked()) {
      await logAudit({ actor: user._id, action: 'BLOCKED_LOCKED_LOGIN_ATTEMPT', targetType: 'User', targetId: user._id, details: { email }, req });
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after 15 minutes or contact Admin.',
      });
    }

    if (!(await user.matchPassword(password))) {
      await user.incLoginAttempts();
      await logAudit({ actor: user._id, action: 'FAILED_LOGIN_ATTEMPT', targetType: 'User', targetId: user._id, details: { email }, req });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact Admin.' });
    }

    // Role validation: if role sent in body, must match stored role
    if (role && user.role !== role) {
      return res.status(401).json({ success: false, message: `Incorrect role selected. This account is registered as '${user.role}'.` });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    await logAudit({ actor: user, action: 'USER_LOGIN', targetType: 'User', targetId: user._id, details: { email }, req });

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        department:   user.department,
        phone:        user.phone,
        active:       user.active,
        avatarColor:  user.avatarColor,
      },
    });
  } catch (err) { return serverError(res, err); }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('delegateHOD', 'name email department');
    res.json({ success: true, user });
  } catch (err) { return serverError(res, err); }
});

// PUT /api/auth/delegate — HOD sets leave delegate
router.put('/delegate', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Only HODs can set a delegate.' });
    }
    const { delegateHODId } = req.body;

    if (delegateHODId) {
      const delegate = await User.findById(delegateHODId);
      if (!delegate || delegate.role !== 'HOD') {
        return res.status(400).json({ success: false, message: 'Delegate must be an active HOD.' });
      }
      if (String(delegateHODId) === String(req.user._id)) {
        return res.status(400).json({ success: false, message: 'Cannot delegate to yourself.' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { delegateHOD: delegateHODId || null },
      { new: true }
    ).populate('delegateHOD', 'name email department');

    res.json({ success: true, delegateHOD: user.delegateHOD });
  } catch (err) { return serverError(res, err); }
});

// POST /api/auth/forgot-password — mock (no real email integration)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  // Always return success (don't leak whether email exists)
  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent. Contact your Admin if you need immediate access.',
  });
});

export default router;
