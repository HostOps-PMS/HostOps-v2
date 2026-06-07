// src/routes/properties.js
// ─────────────────────────────────────────────────────────────────
// Lightweight route that returns the authenticated user's Smoobu
// apartment list. Used by the frontend property-selection screen
// that appears after OTP verification.
//
// For regular users: returns all their Smoobu apartments.
// For staff users: returns only the apartments in their propertyIds
//   list — they must only see and select properties they are assigned to.
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
// Staff users only see properties in their propertyIds assignment.
// ─────────────────────────────────────────────────────────────────
router.get('/properties', requireAuth, async (req, res, next) => {
  try {
    // Load user WITH their smoobuApiKey (select: false — must be explicit).
    // For staff, req.user is already the client user loaded by auth middleware
    // (with smoobuApiKey selected), so we can use it directly.
    // For regular users, we reload to ensure +smoobuApiKey is selected.
    const user = req.isStaff
      ? req.user  // auth middleware already loaded clientUser with +smoobuApiKey
      : await User.findById(req.user._id).select('+smoobuApiKey');

    if (!user) return res.status(404).json({ error: 'User not found' });

    const data = await getApartments(user);
    let apartments = data.apartments || [];

    // ── Staff filtering ──────────────────────────────────────────────
    // Staff members may only select properties they are assigned to.
    // req.staffPropertyIds is set by auth middleware as String[] from staff.propertyIds.
    // We filter Smoobu apartments to only those matching the staff's assigned IDs.
    if (req.isStaff) {
      const allowed = new Set((req.staffPropertyIds || []).map(String));
      apartments = apartments.filter((a) => allowed.has(String(a.id)));
    }

    res.json({ apartments });
  } catch (err) {
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({
        apartments: [],
        smoobuNotConnected: true,
        message: 'No Smoobu account connected.',
      });
    }
    next(err);
  }
});

export default router;
