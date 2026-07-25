import express from 'express';
import VisitorRequest from '../models/VisitorRequest.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { serverError } from '../middleware/serverError.js';

const router = express.Router();

// GET /api/ml/forecast — footfall prediction + anomaly detection + weekly summary
router.get('/forecast', protect, authorize('Admin'), async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── 1. 14-day historical counts ──────────────────────────────
    const history = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
      const count = await VisitorRequest.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
      history.push(count);
    }

    // ── 2. Linear regression forecast (simple-statistics) ────────
    // x = [0..13], y = history values
    let forecast = { tomorrow: 0, day2: 0, day3: 0 };
    try {
      // Simple linear regression: y = m*x + b
      const n = history.length;
      const sumX = history.reduce((s, _, i) => s + i, 0);
      const sumY = history.reduce((s, v) => s + v, 0);
      const sumXY = history.reduce((s, v, i) => s + i * v, 0);
      const sumX2 = history.reduce((s, _, i) => s + i * i, 0);
      const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const b = (sumY - m * sumX) / n;
      forecast = {
        tomorrow: Math.max(0, Math.round(m * 14 + b)),
        day2:     Math.max(0, Math.round(m * 15 + b)),
        day3:     Math.max(0, Math.round(m * 16 + b)),
      };
    } catch (e) {
      const avg = history.reduce((a, b) => a + b, 0) / (history.length || 1);
      forecast = { tomorrow: Math.round(avg), day2: Math.round(avg), day3: Math.round(avg) };
    }

    // ── 3. Anomaly detection — z-score per HOD ───────────────────
    const hods = await User.find({ role: 'HOD', active: true });
    const hodAnomalies = [];

    for (const hod of hods) {
      // Approval counts per day for last 14 days
      const dailyApprovals = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
        const count = await VisitorRequest.countDocuments({
          hodAssigned: hod._id,
          status: { $in: ['HOD Approved', 'Checked-In', 'Checked-Out'] },
          updatedAt: { $gte: d, $lt: nextD },
        });
        dailyApprovals.push(count);
      }

      const mean = dailyApprovals.reduce((a, b) => a + b, 0) / dailyApprovals.length;
      const variance = dailyApprovals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyApprovals.length;
      const std = Math.sqrt(variance);
      const today_count = dailyApprovals[13];
      const zScore = std > 0 ? Math.abs((today_count - mean) / std) : 0;

      if (zScore > 2 || today_count > mean * 2.5) {
        hodAnomalies.push({
          hod: hod.name,
          department: hod.department,
          todayCount: today_count,
          meanDaily: Math.round(mean * 10) / 10,
          zScore: Math.round(zScore * 100) / 100,
          anomalyType: today_count > mean ? 'Unusually High' : 'Unusually Low',
        });
      }
    }

    // ── 4. Weekly summary auto-text ───────────────────────────────
    const thisWeekStart = new Date(today); thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(today); lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const [thisWeek, lastWeek] = await Promise.all([
      VisitorRequest.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      VisitorRequest.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: thisWeekStart } }),
    ]);

    const change = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
    const trend = change > 0 ? `up ${change}%` : change < 0 ? `down ${Math.abs(change)}%` : 'unchanged';

    const topDeptAgg = await VisitorRequest.aggregate([
      { $match: { createdAt: { $gte: thisWeekStart } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);
    const topDept = topDeptAgg[0]?._id || 'N/A';

    const blacklistCount = await VisitorRequest.countDocuments({ blacklistFlag: true, createdAt: { $gte: thisWeekStart } });

    const weeklyInsight = `MECON VMS Weekly Intelligence Summary: Visitor traffic is ${trend} this week (${thisWeek} requests vs ${lastWeek} last week). ` +
      `The highest visitor load was in the ${topDept} department. ` +
      (hodAnomalies.length > 0 ? `${hodAnomalies.length} HOD approval anomaly alert(s) detected. ` : 'No HOD approval anomalies detected. ') +
      (blacklistCount > 0 ? `${blacklistCount} request(s) triggered blacklist flag this week requiring Admin review.` : 'No blacklist flags this week.');

    res.json({
      success: true,
      history,
      forecast: [
        { day: 'Tomorrow', expectedCount: forecast.tomorrow },
        { day: 'Day +2', expectedCount: forecast.day2 },
        { day: 'Day +3', expectedCount: forecast.day3 },
      ],
      hodAnomalies,
      weeklyInsight,
      thisWeek,
      lastWeek,
      weeklyChange: change,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
