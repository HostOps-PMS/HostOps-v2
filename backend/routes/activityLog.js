// src/routes/activityLog.js
import express from 'express';
import ActivityLog from '../models/activityLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Actions only the server may record (Smoobu webhook, 2FA routes). Clients
// logging these would forge bookings / security events in the audit trail.
// ('login' is NOT here: the PIN screen logs it after /auth/verify-pin.)
export const SYSTEM_ACTIONS = new Set([
  'booking_created', 'booking_modified', 'booking_cancelled',
  'totp_enabled', 'totp_disabled', 'totp_device_removed', 'backup_codes_generated',
]);
const MAX_META_BYTES = 4096;

// Validates a client-submitted { action, meta }. Returns an error string or null.
export function clientLogError(action, meta) {
  if (!action || typeof action !== 'string' || !action.trim()) return 'action is required';
  if (SYSTEM_ACTIONS.has(action.trim())) return 'This action is recorded by the server only';
  if (meta !== undefined && (typeof meta !== 'object' || meta === null || Array.isArray(meta))) return 'meta must be an object';
  if (JSON.stringify(meta ?? {}).length > MAX_META_BYTES) return 'meta is too large';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// POST /api/activity-log
// Called by the frontend useActivityLog hook.
// Logs an action for the currently authenticated user (or their
// staff member) into the dedicated ActivityLog collection.
// ─────────────────────────────────────────────────────────────────
router.post('/activity-log', requireAuth, async (req, res, next) => {
  try {
    const { action, meta = {} } = req.body;
    const invalid = clientLogError(action, meta);
    if (invalid) return res.status(400).json({ error: invalid });

    // req.user is always the client/owner (set by requireAuth middleware).
    // req.staff is set only when a staff member is logged in.
    const owner   = req.user;
    const userId  = owner._id;
    const staffId = req.isStaff ? req.staff._id : null;

    // Snapshot the owner account's properties WITHOUT the Smoobu API key.
    // We only keep id + display name so the key is never written to the log.
    const ownerProperties = (owner.properties || []).map((p) => ({
      id:           p._id,
      propertyName: p.propertyName || '',
    }));

    await ActivityLog.create({
      userId,
      staffId,
      performedBy: {
        userId:    req.isStaff ? req.staff._id   : owner._id,
        staffId:   req.isStaff ? req.staff._id   : undefined,
        email:     req.isStaff ? req.staff.email : owner.email,
        firstName: req.isStaff ? req.staff.firstName : (owner.firstName || ''),
        lastName:  req.isStaff ? req.staff.lastName  : (owner.lastName  || ''),
        role:      req.isStaff ? 'staff' : (owner.role || 'client'),
        // staffRole only applies to staff logins; empty for client/admin.
        staffRole: req.isStaff ? (req.staff.staffRole || '') : '',
      },

      // Account context — always taken from the owner/client account.
      // For staff logins this is the client they belong to.
      businessName: owner.businessName || '',
      properties:   ownerProperties,

      action:    action.trim(),
      meta,
      ipAddress: req.ip || '', // not X-Forwarded-For: client-controlled, spoofable
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
    if (req.query.action) filter.action = String(req.query.action).trim();

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
    if (req.query.action) filter.action = String(req.query.action).trim();
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