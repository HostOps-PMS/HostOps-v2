// src/routes/clients.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing platform clients (users).
// Mount in server.js: app.use('/api', clientsRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDashboard } from '../services/smoobu.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────
// GET /api/clients
// Returns all registered users.
// Excludes sensitive fields (password, tokens, smoobuApiKey).
// ─────────────────────────────────────────────────────────────────
router.get('/clients', requireAdmin, async (req, res, next) => {
  try {
    const clients = await User.find({})
      .select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry -smoobuApiKey -__v')
      .sort({ createdAt: -1 })
      .lean();

    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id
// Returns a single client by MongoDB ObjectId.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const client = await User.findById(req.params.id)
      .select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry -smoobuApiKey -__v')
      .lean();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id/smoobu
// Admin views a client's Smoobu dashboard data.
//
// The client's smoobuApiKey is loaded server-side (+smoobuApiKey) and
// is NEVER sent to the frontend — the server fetches Smoobu on the
// client's behalf and returns only the dashboard payload.
//
// If the client has no key, returns { smoobuNotConnected: true }.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id/smoobu', requireAdmin, async (req, res, next) => {
  try {
    // Load user WITH their smoobuApiKey (select:false — must be explicit)
    const user = await User.findById(req.params.id).select('+smoobuApiKey');

    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If no key at all, return a clean "not connected" response
    if (!user.smoobuApiKey || !user.smoobuApiKey.trim()) {
      return res.status(200).json({
        smoobuNotConnected: true,
        message: 'This client has no Smoobu API key configured.',
      });
    }

    const data = await getDashboard(user, {
      from: req.query.from,
      to:   req.query.to,
    });

    res.json(data);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    // getDashboard throws this when there's no key — belt-and-suspenders
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({
        smoobuNotConnected: true,
        message: err.message,
      });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/clients
// Admin creates a new user account with a temporary password.
// Sets mustChangePassword: true so the user is forced to set
// their own password on first login before gaining full access.
// isVerified is intentionally left false — it becomes true only
// after the user completes the first-login password change.
// ─────────────────────────────────────────────────────────────────
const createClientSchema = z.object({
  firstName:         z.string().min(1).max(50).trim(),
  lastName:          z.string().max(50).trim().optional().default(''),
  email:             z.string().email().max(254),
  password:          z.string().min(8).max(128),
  role:              z.enum(['client', 'admin', 'team_leader']).optional().default('client'),
  propertyTagPrefix: z.string().max(100).trim().optional().default(''),
  smoobuApiKey:      z.string().max(512).optional().default(''),
  serverId:          z.string().optional(),
});

router.post('/clients', requireAdmin, async (req, res, next) => {
  try {
    const data = createClientSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (data.role === 'team_leader') {
      if (!data.serverId) {
        return res.status(400).json({ error: 'Server assignment is required for Team Leaders.' });
      }
      const serverUser = await User.findOne({ _id: data.serverId, role: 'client' });
      if (!serverUser) {
        return res.status(400).json({ error: 'Invalid server selected. Must be an existing client.' });
      }
    }

    const user = await User.create({
      firstName:          data.firstName,
      lastName:           data.lastName || '',
      email:              data.email.toLowerCase(),
      password:           data.password,
      role:               data.role,
      propertyTagPrefix:  data.propertyTagPrefix || '',
      smoobuApiKey:       data.smoobuApiKey || null,
      serverId:           data.serverId || null,
      isVerified:         false,
      mustChangePassword: true,
    });

    res.status(201).json({
      message: 'Account created successfully.',
      userId: user._id,
      user: user.toJSON(),
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id
// Admin updates a client's editable fields:
//   - role
//   - propertyTagPrefix
//   - smoobuApiKey (optional — only updated if provided)
// All other fields (email, password, isVerified, etc.) are
// intentionally excluded to prevent accidental overwrites.
// ─────────────────────────────────────────────────────────────────
const updateClientSchema = z.object({
  firstName:         z.string().min(1).max(50).trim().optional(),
  lastName:          z.string().max(50).trim().optional(),
  serverId:          z.string().optional(),
  role:              z.enum(['client', 'admin', 'team_leader']).optional(),
  propertyTagPrefix: z.string().max(100).trim().optional(),
  smoobuApiKey:      z.string().max(512).optional(),
});

router.patch('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const update = {};
    if (data.firstName         !== undefined) update.firstName         = data.firstName;
    if (data.lastName          !== undefined) update.lastName          = data.lastName;
    if (data.serverId          !== undefined) update.serverId          = data.serverId || null;
    if (data.role              !== undefined) update.role              = data.role;
    if (data.propertyTagPrefix !== undefined) update.propertyTagPrefix = data.propertyTagPrefix;
    if (data.smoobuApiKey      !== undefined) {
      update.smoobuApiKey      = data.smoobuApiKey.trim() || null;
      update.smoobuConnectedAt = data.smoobuApiKey.trim() ? new Date() : null;
    }

    const client = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry -smoobuApiKey -__v')
      .lean();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/clients/:id
// Admin deletes a client or team leader account.
// ─────────────────────────────────────────────────────────────────
router.delete('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

export default router;