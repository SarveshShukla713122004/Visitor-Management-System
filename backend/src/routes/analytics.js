import express from 'express';
import VisitorRequest from '../models/VisitorRequest.js';
import User from '../models/User.js';
import Blacklist from '../models/Blacklist.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// GET /api/analytics/dashboard — role-scoped metrics and chart data
router.get('/dashboard', protect, async (req, res) => {
  try {
    const role = req.user.role;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    let metrics = {};

    // ── Admin ────────────────────────────────────────────────────
    if (role === 'Admin') {
      const [totalUsers, pendingRequests, approvedToday, currentlyCheckedIn, blacklistFlagged] = await Promise.all([
        User.countDocuments({ active: true }),
        VisitorRequest.countDocuments({ status: 'Pending' }),
        VisitorRequest.countDocuments({ status: { $in: ['HOD Approved', 'Checked-In', 'Checked-Out'] }, updatedAt: { $gte: today } }),
        VisitorRequest.countDocuments({ status: 'Checked-In' }),
        VisitorRequest.countDocuments({ blacklistFlag: true }),
      ]);

      // 14-day footfall trend
      const dailyCounts = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
        const count = await VisitorRequest.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
        dailyCounts.push({ date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), count });
      }

      // Purpose breakdown
      const purposeAgg = await VisitorRequest.aggregate([
        { $group: { _id: '$purpose', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const purposeDistribution = purposeAgg.map(p => ({ purpose: p._id || 'Other', count: p.count }));

      // Department-wise visitor load
      const deptAgg = await VisitorRequest.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);
      const departmentDistribution = deptAgg.map(d => ({ department: d._id || 'General', count: d.count }));

      // Average visit duration (minutes)
      const completedRequests = await VisitorRequest.find({
        status: 'Checked-Out',
        checkInTime: { $exists: true },
        checkOutTime: { $exists: true },
      });
      let totalMins = 0;
      completedRequests.forEach(r => {
        totalMins += (new Date(r.checkOutTime) - new Date(r.checkInTime)) / (1000 * 60);
      });
      const avgDurationMins = completedRequests.length > 0
        ? Math.round(totalMins / completedRequests.length)
        : 0;

      // HOD Bottleneck — avg approval time per HOD
      const hods = await User.find({ role: 'HOD', active: true });
      const hodBottleneck = [];
      for (const hod of hods) {
        const approved = await VisitorRequest.find({
          hodAssigned: hod._id,
          status: { $in: ['HOD Approved', 'Checked-In', 'Checked-Out'] },
        }).select('createdAt history');

        let totalApprovalMins = 0, count = 0;
        for (const req of approved) {
          const approvalStep = req.history.find(h => h.action === 'HOD Approved');
          if (approvalStep) {
            const mins = (new Date(approvalStep.timestamp) - new Date(req.createdAt)) / (1000 * 60);
            totalApprovalMins += mins;
            count++;
          }
        }
        hodBottleneck.push({
          hod: hod.name,
          department: hod.department,
          avgApprovalMins: count > 0 ? Math.round(totalApprovalMins / count) : 0,
          totalProcessed: count,
        });
      }
      hodBottleneck.sort((a, b) => b.avgApprovalMins - a.avgApprovalMins);

      // Rejection rate by purpose
      const rejectionAgg = await VisitorRequest.aggregate([
        { $group: { _id: '$purpose', total: { $sum: 1 }, rejected: { $sum: { $cond: [{ $eq: ['$status', 'HOD Rejected'] }, 1, 0] } } } },
        { $project: { purpose: '$_id', total: 1, rejected: 1, rejectionRate: { $multiply: [{ $divide: ['$rejected', '$total'] }, 100] } } },
        { $sort: { rejectionRate: -1 } },
      ]);
      const rejectionByPurpose = rejectionAgg.map(r => ({
        purpose: r._id,
        total: r.total,
        rejected: r.rejected,
        rejectionRate: Math.round(r.rejectionRate),
      }));

      metrics = {
        totalUsers, pendingRequests, approvedToday, currentlyCheckedIn, blacklistFlagged,
        dailyCounts, purposeDistribution, departmentDistribution, avgDurationMins,
        hodBottleneck, rejectionByPurpose,
      };

    // ── HOD ──────────────────────────────────────────────────────
    } else if (role === 'HOD') {
      const [pendingReview, approvedThisWeek, rejectedThisWeek] = await Promise.all([
        VisitorRequest.countDocuments({ department: req.user.department, status: 'Pending' }),
        VisitorRequest.countDocuments({ department: req.user.department, status: { $in: ['HOD Approved', 'Checked-In', 'Checked-Out'] }, updatedAt: { $gte: weekAgo } }),
        VisitorRequest.countDocuments({ department: req.user.department, status: 'HOD Rejected', updatedAt: { $gte: weekAgo } }),
      ]);
      metrics = { pendingReview, approvedThisWeek, rejectedThisWeek };

    // ── Security ─────────────────────────────────────────────────
    } else if (role === 'Security') {
      const [approvedQueue, currentlyCheckedIn, todayCheckIns, blacklistFlagged] = await Promise.all([
        VisitorRequest.countDocuments({ status: 'HOD Approved' }),
        VisitorRequest.countDocuments({ status: 'Checked-In' }),
        VisitorRequest.countDocuments({ status: { $in: ['Checked-In', 'Checked-Out'] }, checkInTime: { $gte: today } }),
        VisitorRequest.countDocuments({ status: 'Blacklist Flagged' }),
      ]);
      metrics = { approvedQueue, currentlyCheckedIn, todayCheckIns, blacklistFlagged };

    // ── Employee ─────────────────────────────────────────────────
    } else if (role === 'Employee') {
      const [myPending, myApprovedToday, myCheckedIn, myTotal] = await Promise.all([
        VisitorRequest.countDocuments({ submittedBy: req.user._id, status: 'Pending' }),
        VisitorRequest.countDocuments({ submittedBy: req.user._id, status: { $in: ['HOD Approved', 'Checked-In'] }, updatedAt: { $gte: today } }),
        VisitorRequest.countDocuments({ submittedBy: req.user._id, status: 'Checked-In' }),
        VisitorRequest.countDocuments({ submittedBy: req.user._id }),
      ]);
      metrics = { myPending, myApprovedToday, myCheckedIn, myTotal };
    }

    res.json({ success: true, role, metrics });
  } catch (err) { return serverError(res, err); }
});

export default router;
