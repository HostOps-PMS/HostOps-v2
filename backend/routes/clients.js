// src/routes/clients.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing platform clients (users).
// Mount in server.js: app.use('/api', clientsRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import User from '../models/user.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Guard: admin only
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

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
    // Invalid ObjectId format
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

export default router;
