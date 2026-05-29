// src/routes/clientAccounts.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing client sub-accounts.
// Each clientAccount is linked to a parentClientId (a User with
// role: 'client') and a list of Smoobu property IDs.
//
// Pattern mirrors src/routes/staffs.js exactly — same middleware,
// same Smoobu property lookup, same CRUD shape.
//
// Mount in server.js: app.use('/api', clientAccountsRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z } from 'zod';
import ClientAccount from '../models/clientAccount.js';
import User          from '../models/user.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getApartments } from '../services/smoobu.js';

const router = express.Router();

router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────
// GET /api/client-accounts
// Returns all client sub-accounts.
// Optional query: ?parentClientId=<mongoId> — filter by parent client.
// ─────────────────────────────────────────────────────────────────
router.get('/client-accounts', requireAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.parentClientId) {
      filter.parentClientId = req.query.parentClientId;
    }

    const accounts = await ClientAccount.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/client-accounts/:id
// Returns a single client sub-account by MongoDB ObjectId.
// ─────────────────────────────────────────────────────────────────
router.get('/client-accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const account = await ClientAccount.findById(req.params.id).lean();
    if (!account) return res.status(404).json({ error: 'Client account not found' });
    res.json(account);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/client-accounts/by-parent/:parentClientId
// Returns all sub-accounts for a specific parent client.
// Convenience endpoint used by the frontend dropdown.
// ─────────────────────────────────────────────────────────────────
router.get('/client-accounts/by-parent/:parentClientId', requireAdmin, async (req, res, next) => {
  try {
    const accounts = await ClientAccount.find({ parentClientId: req.params.parentClientId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(accounts);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/client-accounts
// Admin creates a new client sub-account linked to a parent client.
// mustChangePassword: true — user must set own password on first login.
// ─────────────────────────────────────────────────────────────────
const createAccountSchema = z.object({
  parentClientId: z.string().min(1),
  firstName:      z.string().min(1).max(50).trim(),
  lastName:       z.string().max(50).trim().optional().default(''),
  email:          z.string().email().max(254),
  password:       z.string().min(8).max(128),
});

router.post('/client-accounts', requireAdmin, async (req, res, next) => {
  try {
    const data = createAccountSchema.parse(req.body);

    // Verify the parent client exists and is actually a client role
    const parent = await User.findById(data.parentClientId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent client not found' });
    }
    if (parent.role !== 'client') {
      return res.status(400).json({ error: 'Parent must be a client user' });
    }

    const existing = await ClientAccount.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const account = await ClientAccount.create({
      parentClientId:     data.parentClientId,
      firstName:          data.firstName,
      lastName:           data.lastName || '',
      email:              data.email.toLowerCase(),
      password:           data.password,
      isActive:           true,
      mustChangePassword: true,
    });

    res.status(201).json({
      message: 'Client account created successfully.',
      accountId: account._id,
      account: account.toJSON(),
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/client-accounts/:id
// Admin updates an existing client sub-account.
// ─────────────────────────────────────────────────────────────────
const updateAccountSchema = z.object({
  firstName:   z.string().min(1).max(50).trim().optional(),
  lastName:    z.string().max(50).trim().optional(),
  isActive:    z.boolean().optional(),
  password:    z.string().min(8).max(128).optional(),
});

router.patch('/client-accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = updateAccountSchema.parse(req.body);

    const account = await ClientAccount.findById(req.params.id).select('+password');
    if (!account) return res.status(404).json({ error: 'Client account not found' });

    if (data.firstName   !== undefined) account.firstName   = data.firstName;
    if (data.lastName    !== undefined) account.lastName    = data.lastName;
    if (data.isActive    !== undefined) account.isActive    = data.isActive;
    if (data.password    !== undefined) {
      account.password           = data.password;
      account.mustChangePassword = true;
    }

    await account.save();
    res.json(account.toJSON());
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/client-accounts/:id
// Admin permanently deletes a client sub-account.
// ─────────────────────────────────────────────────────────────────
router.delete('/client-accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const account = await ClientAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Client account not found' });

    await ClientAccount.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client account deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    next(err);
  }
});

export default router;