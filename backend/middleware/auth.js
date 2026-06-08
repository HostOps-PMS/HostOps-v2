// src/middleware/auth.js
import { verifyAccessToken } from '../utils/tokens.js';
import User         from '../models/user.js';
import Staff        from '../models/staff.js';
import RevokedToken from '../models/revokedToken.js';

export async function requireAuth(req, res, next) {
  try {
    // ── 1. Extract token ─────────────────────────────────────────
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    // ── 2 & 3. Decrypt → verify JWT ──────────────────────────────
    // verifyAccessToken() does: decrypt(blob) → jwt.verify(raw)
    // Throws TokenExpiredError or JsonWebTokenError on failure.
    const decoded = verifyAccessToken(token);

    // ── 4. Check jti revocation ──────────────────────────────────
    // If the token was explicitly revoked (logout, password change,
    // tab-close beacon) its jti will exist in the RevokedToken collection.
    if (decoded.jti) {
      const isRevoked = await RevokedToken.exists({ jti: decoded.jti });
      if (isRevoked) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    // ── 5a. STAFF LOGIN ──────────────────────────────────────────
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff) return res.status(401).json({ error: 'Staff not found' });
      if (!staff.isActive) return res.status(403).json({ error: 'Staff account is inactive' });

      const clientUser = await User.findById(staff.clientId).select('+properties.smoobuApiKey');
      if (!clientUser) return res.status(401).json({ error: 'Client account not found' });

      req.user    = clientUser;
      req.staff   = staff;
      req.isStaff = true;

      const assignedIds    = new Set((staff.propertyIds || []).map(String));
      const propertyDbIds  = new Set();
      const smoobuIds      = new Set();

      for (const prop of clientUser.properties || []) {
        const propertyAssigned   = assignedIds.has(String(prop._id));
        let subPropertyAssigned  = false;

        for (const sub of prop.subProperties || []) {
          const subId = String(sub.smoobuId);
          if (assignedIds.has(subId)) {
            subPropertyAssigned = true;
            smoobuIds.add(subId);
          }
          if (propertyAssigned && sub.smoobuId) smoobuIds.add(subId);
        }

        if (propertyAssigned || subPropertyAssigned) {
          propertyDbIds.add(String(prop._id));
        }
      }

      req.staffPropertyDbIds = Array.from(propertyDbIds);
      req.staffPropertyIds   = Array.from(smoobuIds);
      return next();
    }

    // ── 5b. REGULAR USER / ADMIN ─────────────────────────────────
    const user = await User.findById(decoded.sub).select('+properties.smoobuApiKey');
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Team leaders: inject client's smoobu API key in memory
    if (user.role === 'team_leader' && user.serverId) {
      const clientUser = await User.findById(user.serverId).select('+properties.smoobuApiKey');
      if (clientUser?.properties?.length) {
        user.properties = clientUser.properties;
      }
    }

    // Block unverified self-registered accounts (admin-created must-change-password is allowed)
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

// ── requireAdmin ─────────────────────────────────────────────────
export function requireAdmin(req, res, next) {
  if (req.isStaff) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── requireAdminOrTeamLeader ──────────────────────────────────────
export function requireAdminOrTeamLeader(req, res, next) {
  if (req.isStaff) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user?.role !== 'admin' && req.user?.role !== 'team_leader') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}