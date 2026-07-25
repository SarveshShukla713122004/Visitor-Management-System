import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// GET /api/audit — Admin: system-wide audit log
router.get('/', protect, authorize('Admin'), async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('actor', 'name role');
    res.json({ success: true, logs, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return serverError(res, err); }
});

export default router;
