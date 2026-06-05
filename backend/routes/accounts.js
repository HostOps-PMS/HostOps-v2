// src/routes/accounts.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for platform account management.
//
// Mount in server.js: app.use('/api', accountsRoutes);
//
// GET  /api/accounts
//   Returns: { users: [...], staffs: [...] }
//
// GET  /api/accounts/recovery-request?email=xxx
//   Returns the latest PENDING RecoveryRequest for the given email.
//   Only pending requests are returned — resolved/dismissed ones are
//   tied to a past lockout instance and must not appear on new lockouts.
//   Used by the Unlock modal to show the user's submitted reason AND
//   to gate whether the Unlock button is enabled (no pending = no unlock).
//
// POST /api/accounts/unlock
//   Unlocks PIN lockout for a user or staff account.
//   Body: { email, accountType: 'user'|'staff' }
//   This is the dedicated unlock endpoint — the existing PATCH /api/clients/:id
//   and PATCH /api/staffs/:id endpoints do NOT accept pin lockout fields
//   in their Zod schemas, so they silently ignore them.
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z }   from 'zod';
import User            from '../models/user.js';
import Staff           from '../models/staff.js';
import RecoveryRequest from '../models/RecoveryRequest.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────
// GET /api/accounts
// Returns all users and staffs with PIN lockout info.
// Sensitive fields (password, tokens, pin hash) are excluded.
// ─────────────────────────────────────────────────────────────────
router.get('/accounts', async (req, res, next) => {
  try {
    const [users, staffs] = await Promise.all([
      User.find({})
        .select(
          '_id email businessName firstName lastName role ' +
          'pinAttempts pinLockedUntil pinPermanentlyLocked ' +
          'lastLoginAt isVerified mustChangePassword createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .lean(),

      Staff.find({})
        .select(
          '_id email firstName lastName clientId staffRole isActive ' +
          'pinAttempts pinLockedUntil pinPermanentlyLocked ' +
          'lastLoginAt mustChangePin createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({ users, staffs });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/accounts/recovery-request?email=xxx
//
// Returns the latest PENDING RecoveryRequest for the given email.
//
// Only 'pending' requests are returned. Once a request is resolved
// or dismissed (tied to a past lockout), it must NOT appear on a
// new lockout — each lockout instance requires a fresh submission.
//
// The frontend uses { found } to decide whether to enable the
// Unlock button: no pending request = Unlock button disabled.
//
// Response:
//   { found: true,  request: { _id, email, reason, status, createdAt, ... } }
//   { found: false }
// ─────────────────────────────────────────────────────────────────
router.get('/accounts/recovery-request', async (req, res, next) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }

    // Only return pending requests — resolved/dismissed ones belong to
    // a previous lockout instance and must not appear on a new lockout.
    const request = await RecoveryRequest.findOne({ email, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    if (!request) {
      return res.json({ found: false });
    }

    return res.json({ found: true, request });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/accounts/unlock
//
// Dedicated endpoint for resetting PIN lockout fields.
// The existing PATCH /api/clients/:id and PATCH /api/staffs/:id
// endpoints strip these fields via Zod schema — they are intentionally
// not editable through those general-purpose update routes.
//
// Body:
//   email        {string}  — email of the account to unlock
//   accountType  {string}  — 'user' | 'staff'
//
// Also auto-resolves any pending RecoveryRequest for this email.
// ─────────────────────────────────────────────────────────────────
const unlockSchema = z.object({
  email:       z.string().email().trim(),
  accountType: z.enum(['user', 'staff']),
});

router.post('/accounts/unlock', async (req, res, next) => {
  try {
    const data = unlockSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase();

    const unlockFields = {
      pinAttempts:          0,
      lastPinFailAt:        null,
      pinLockedUntil:       null,
      pinPermanentlyLocked: false,
    };

    let updated = false;

    if (data.accountType === 'staff') {
      const result = await Staff.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: unlockFields },
        { new: true }
      );
      if (!result) {
        return res.status(404).json({ error: 'Staff account not found.' });
      }
      updated = true;
    } else {
      const result = await User.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: unlockFields },
        { new: true }
      );
      if (!result) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      updated = true;
    }

    // Auto-resolve any pending recovery request for this email
    if (updated) {
      await RecoveryRequest.findOneAndUpdate(
        { email: normalizedEmail, status: 'pending' },
        {
          $set: {
            status:       'resolved',
            resolvedAt:   new Date(),
            resolvedBy:   req.user._id,
            resolvedNote: 'Account unlocked by admin via Accounts page.',
          },
        }
      );
    }

    res.json({ ok: true, message: 'Account PIN lockout has been cleared.' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

export default router;