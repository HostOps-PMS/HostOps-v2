// src/routes/clients.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing platform clients (users).
// Mount in server.js: app.use('/api', clientsRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(requireAuth);
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────
// GET /api/clients
// Returns all registered users.
// Excludes sensitive fields (password, tokens, smoobuApiKey).
// ─────────────────────────────────────────────────────────────────
router.get('/clients', async (req, res, next) => {
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
router.get('/clients/:id', async (req, res, next) => {
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
  role:              z.enum(['client', 'admin']).optional().default('client'),
  propertyTagPrefix: z.string().max(100).trim().optional().default(''),
  smoobuApiKey:      z.string().max(512).optional().default(''),
});

router.post('/clients', async (req, res, next) => {
  try {
    const data = createClientSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      firstName:          data.firstName,
      lastName:           data.lastName || '',
      email:              data.email.toLowerCase(),
      password:           data.password,
      role:               data.role,
      propertyTagPrefix:  data.propertyTagPrefix || '',
      smoobuApiKey:       data.smoobuApiKey || null,
      // Admin-created accounts skip email verification.
      // Instead, the user must change their temporary password on first login,
      // which sets isVerified: true and mustChangePassword: false.
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

export default router;