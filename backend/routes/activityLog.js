// src/routes/activityLog.js
import express from 'express';
import ActivityLog from '../models/activityLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// POST /api/activity-log
// Called by the frontend useActivityLog hook.
// Logs an action for the currently authenticated user (or their
// staff member) into the dedicated ActivityLog collection.
// ─────────────────────────────────────────────────────────────────
router.post('/activity-log', requireAuth, async (req, res, next) => {
  try {
    const { action, meta = {} } = req.body;
    if (!action || typeof action !== 'string' || !action.trim()) {
      return res.status(400).json({ error: 'action is required' });
    }

    // req.user is always the client/owner (set by requireAuth middleware).
    // req.staff is set only when a staff member is logged in.
    const userId  = req.user._id;
    const staffId = req.isStaff ? req.staff._id : null;

    await ActivityLog.create({
      userId,
      staffId,
      performedBy: {
        userId:    req.isStaff ? req.staff._id   : req.user._id,
        staffId:   req.isStaff ? req.staff._id   : undefined,
        email:     req.isStaff ? req.staff.email : req.user.email,
        firstName: req.isStaff ? req.staff.firstName : (req.user.firstName || ''),
        lastName:  req.isStaff ? req.staff.lastName  : (req.user.lastName  || ''),
        role:      req.isStaff ? 'staff' : (req.user.role || 'client'),
      },
      action:    action.trim(),
      meta,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/activity-log
// Returns the activity log for the currently logged-in user.
// Supports pagination via ?page=1&limit=50
// Supports filtering via ?action=login
// ─────────────────────────────────────────────────────────────────
router.get('/activity-log', requireAuth, async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip   = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.action) filter.action = req.query.action.trim();

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      activityLog: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/activity-log/all  (admin only)
// Returns logs across ALL users. Supports filtering by userId,
// action, and date range (?from=2024-01-01&to=2024-12-31).
// ─────────────────────────────────────────────────────────────────
router.get('/activity-log/all', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action.trim();
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      activityLog: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/activity-log  (admin only)
// Deletes all logs older than a given date.
// Body: { before: "2024-01-01" }  (ISO date string)
// ─────────────────────────────────────────────────────────────────
router.delete('/activity-log', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { before } = req.body;
    if (!before) return res.status(400).json({ error: 'before date is required' });

    const cutoff = new Date(before);
    if (isNaN(cutoff.getTime())) return res.status(400).json({ error: 'Invalid date format' });

    const result = await ActivityLog.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) { next(err); }
});

export default router;
