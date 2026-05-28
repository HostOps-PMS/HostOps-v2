// src/routes/properties.js
// ─────────────────────────────────────────────────────────────────
// Lightweight route that returns only the authenticated user's
// Smoobu apartment list.  Used by the frontend property-selection
// screen that appears after OTP verification.
//
// Mount in server.js: app.use('/api', propertiesRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import User from '../models/user.js';
import { requireAuth } from '../middleware/auth.js';
import { getApartments } from '../services/smoobu.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// GET /api/properties
// Returns the current user's Smoobu properties.
// If the user has no Smoobu key configured, returns an empty array
// with smoobuNotConnected: true so the frontend can handle gracefully.
// ─────────────────────────────────────────────────────────────────
router.get('/properties', requireAuth, async (req, res, next) => {
  try {
    // Load user WITH their smoobuApiKey (select: false — must be explicit)
    const user = await User.findById(req.user._id).select('+smoobuApiKey');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const data = await getApartments(user);
    res.json({ properties: data.apartments || [] });
  } catch (err) {
    // Graceful fallback: no Smoobu key connected
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({
        properties: [],
        smoobuNotConnected: true,
        message: 'No Smoobu account connected.',
      });
    }
    next(err);
  }
});

export default router;
