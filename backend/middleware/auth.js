// src/middleware/auth.js
import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/user.js';
import Staff from '../models/staff.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const decoded = verifyAccessToken(token);

    // ── STAFF LOGIN ────────────────────────────────────────────────
    // Staff tokens carry role: 'staff' and clientId in the payload.
    // We load the Staff record for auth checks, and the client's User
    // record (with smoobuApiKey) so the Smoobu service can use the
    // correct API key when fetching data on behalf of this staff member.
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff) return res.status(401).json({ error: 'Staff not found' });
      if (!staff.isActive) return res.status(403).json({ error: 'Staff account is inactive' });

      // Load the client user WITH smoobuApiKey so dashboard routes can
      // call the Smoobu API using the client's own key.
      const clientUser = await User.findById(staff.clientId).select('+smoobuApiKey');
      if (!clientUser) return res.status(401).json({ error: 'Client account not found' });

      // Attach both to req so downstream routes and services have access.
      // req.user is set to clientUser so all existing Smoobu service calls
      // (which use req.user for the API key) work without any changes.
      // req.staff holds the staff record for property-level filtering.
      req.user        = clientUser;
      req.staff       = staff;
      req.isStaff     = true;
      // Normalise propertyIds to strings for comparison — Smoobu IDs are
      // numbers but the Staff schema stores them as strings.
      req.staffPropertyIds = (staff.propertyIds || []).map(String);

      return next();
    }

    // ── REGULAR USER / ADMIN LOGIN ─────────────────────────────────
    // Select +smoobuApiKey so the smoobu service can use the
    // user's own Smoobu API key on every authenticated request.
    // Without this, smoobuApiKey is always null (select: false in schema)
    // and every request falls back to the global env key — which belongs
    // to only one account, causing other users to see wrong/no data.
    const user = await User.findById(decoded.sub).select('+smoobuApiKey');
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Allow through if the user must change their password (admin-created account).
    // They are not yet verified, but the /auth/change-password endpoint
    // needs to be accessible so they can complete the first-login flow.
    if (!user.isVerified && !user.mustChangePassword) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    req.user    = user;
    req.isStaff = false;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  // Staff members are never admins regardless of their client's role
  if (req.isStaff) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}