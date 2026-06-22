// src/routes/recoveryRequests.js
// ─────────────────────────────────────────────────────────────────
// Two separate exported routers:
//
//   publicRecoveryRouter  — POST /recovery-request  (no auth)
//                           Mount as: app.use('/auth', publicRecoveryRouter)
//
//   adminRecoveryRouter   — GET/PATCH /recovery-requests (admin only)
//                           Mount as: app.use('/api', adminRecoveryRouter)
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z }   from 'zod';
import RecoveryRequest from '../models/RecoveryRequest.js';
import User            from '../models/user.js';
import Staff           from '../models/staff.js';
import { validateObjectId } from '../middleware/ownershipGuard.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

// ═════════════════════════════════════════════════════════════════
// PUBLIC ROUTER — no authentication required
// Mounted under /auth in server.js → final path: POST /auth/recovery-request
// ═════════════════════════════════════════════════════════════════
export const publicRecoveryRouter = express.Router();

const submitSchema = z.object({
  email:       z.string().email().max(254).trim(),
  reason:      z.string()
               .min(10, 'Please provide at least 10 characters explaining your situation.')
               .max(1000)
               .trim(),
  requestType: z.enum(['pin_recovery', 'account_disabled']).optional().default('pin_recovery'),
});

publicRecoveryRouter.post('/recovery-request', async (req, res, next) => {
  try {
    const data = submitSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase();
    const requestType     = data.requestType;

    // Determine accountType by checking both collections.
    // Always return 201 regardless — prevents email enumeration.
    let accountType = 'user';

    const userDoc  = await User.findOne({ email: normalizedEmail }).lean();
    const staffDoc = !userDoc
      ? await Staff.findOne({ email: normalizedEmail }).lean()
      : null;

    if (staffDoc) accountType = 'staff';

    // If neither found, still silently return success
    if (userDoc || staffDoc) {
      // Prevent duplicate pending requests for the same email+type (idempotent)
      const existing = await RecoveryRequest.findOne({
        email:       normalizedEmail,
        status:      'pending',
        requestType,
      });

      if (!existing) {
        await RecoveryRequest.create({
          email:       normalizedEmail,
          accountType,
          reason:      data.reason,
          status:      'pending',
          requestType,
        });
      }
    }

    return res.status(201).json({
      message: 'Recovery request submitted. An administrator will review it shortly.',
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════
// ADMIN ROUTER — requireAuth + requireAdmin on every route
// Mounted under /api in server.js
// ═════════════════════════════════════════════════════════════════
export const adminRecoveryRouter = express.Router();

// Apply auth middleware to all routes in this router
adminRecoveryRouter.use(requireAuth);
adminRecoveryRouter.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────
// GET /api/recovery-requests
// Optional query: ?status=pending|resolved|dismissed
// ─────────────────────────────────────────────────────────────────
adminRecoveryRouter.get('/recovery-requests', async (req, res, next) => {
  try {
    const filter = {};
    const allowedStatuses  = ['pending', 'resolved', 'dismissed'];
    const allowedTypes     = ['pin_recovery', 'account_disabled'];
    if (req.query.status && allowedStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.requestType && allowedTypes.includes(req.query.requestType)) {
      filter.requestType = req.query.requestType;
    }

    const requests = await RecoveryRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/recovery-requests/:id
// ─────────────────────────────────────────────────────────────────
adminRecoveryRouter.get('/recovery-requests/:id', validateObjectId('id'), async (req, res, next) => {
  try {
    const request = await RecoveryRequest.findById(req.params.id).lean();
    if (!request) return res.status(404).json({ error: 'Recovery request not found' });
    res.json(request);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/recovery-requests/:id
// Body: { status, resolvedNote?, unlockAccount? }
// unlockAccount: true → also resets PIN lockout fields on the account
// ─────────────────────────────────────────────────────────────────
const resolveSchema = z.object({
  status:        z.enum(['resolved', 'dismissed']),
  resolvedNote:  z.string().max(500).trim().optional().default(''),
  unlockAccount: z.boolean().optional().default(false),
  enableAccount: z.boolean().optional().default(false),
});

adminRecoveryRouter.patch('/recovery-requests/:id', validateObjectId('id'), async (req, res, next) => {
  try {
    const data = resolveSchema.parse(req.body);

    const request = await RecoveryRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Recovery request not found' });

    request.status       = data.status;
    request.resolvedAt   = new Date();
    request.resolvedBy   = req.user._id;
    request.resolvedNote = data.resolvedNote || '';
    await request.save();

    // Optionally reset PIN lockout so account can be used immediately
    if (data.unlockAccount && data.status === 'resolved') {
      const unlockFields = {
        pinAttempts:          0,
        pinLockedUntil:       null,
        pinPermanentlyLocked: false,
      };

      if (request.accountType === 'staff') {
        await Staff.findOneAndUpdate({ email: request.email }, { $set: unlockFields });
      } else {
        await User.findOneAndUpdate({ email: request.email }, { $set: unlockFields });
      }
    }

    // enableAccount: re-enable a disabled (archived) account
    if (data.enableAccount && data.status === 'resolved') {
      if (request.accountType === 'staff') {
        await Staff.findOneAndUpdate({ email: request.email }, { $set: { isArchive: false } });
      } else {
        await User.findOneAndUpdate({ email: request.email }, { $set: { isArchive: false } });
      }
    }

    res.json({
      message: `Recovery request marked as ${data.status}.`,
      request: request.toObject(),
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    next(err);
  }
});