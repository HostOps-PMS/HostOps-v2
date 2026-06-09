// src/middleware/auth.js
import { verifyAccessToken } from '../utils/tokens.js';
import User         from '../models/user.js';
import Staff        from '../models/staff.js';
import RevokedToken from '../models/revokedToken.js';
import RefreshToken from '../models/refreshToken.js';


export async function requireAuth(req, res, next) {
  try {
    // ── 1. Extract token ─────────────────────────────────────────
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    // ── 2 & 3. Decrypt → verify JWT ──────────────────────────────
    // verifyAccessToken() does: decrypt(blob) → jwt.verify(raw)
    const decoded = verifyAccessToken(token);

    // ── 4. Require jti — reject tokens that don't carry one ─────
    if (!decoded.jti) {
      return res.status(401).json({ error: 'Invalid token: missing jti' });
    }

    // ── 5. Check jti revocation ──────────────────────────────────
    const isRevoked = await RevokedToken.exists({ jti: decoded.jti });
    if (isRevoked) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // ── 6. Session-ownership check (applies to ALL token types) ──
    const owningSession = await RefreshToken.findOne({
      accessJti: decoded.jti,
    });

    if (!owningSession) {
      return res.status(403).json({ error: 'Forbidden: token session not found' });
    }

    if (!owningSession.isActive()) {
      return res.status(403).json({ error: 'Forbidden: session has been revoked' });
    }

    // ── 7a. STAFF ────────────────────────────────────────────────
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff)      return res.status(401).json({ error: 'Staff not found' });
      if (!staff.isActive) return res.status(403).json({ error: 'Staff account is inactive' });

      // Verify the session row actually belongs to this staff member
      if (owningSession.staffId && String(owningSession.staffId) !== String(staff._id)) {
        return res.status(403).json({ error: 'Forbidden: token does not belong to this staff session' });
      }

      const clientUser = await User.findById(staff.clientId).select('+properties.smoobuApiKey');
      if (!clientUser) return res.status(401).json({ error: 'Client account not found' });

      req.user    = clientUser;
      req.staff   = staff;
      req.isStaff = true;
      req.userId  = String(staff._id);

      const assignedIds   = new Set((staff.propertyIds || []).map(String));
      const propertyDbIds = new Set();
      const smoobuIds     = new Set();

      for (const prop of clientUser.properties || []) {
        const propertyAssigned  = assignedIds.has(String(prop._id));
        let subPropertyAssigned = false;

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

    // ── 7b. REGULAR USER / ADMIN ─────────────────────────────────
    // Verify the session row belongs to the user in the token
    if (String(owningSession.userId) !== String(decoded.sub)) {
      return res.status(403).json({ error: 'Forbidden: token does not belong to this session' });
    }

    const user = await User.findById(decoded.sub).select('+properties.smoobuApiKey');
    if (!user) return res.status(401).json({ error: 'User not found' });

    if (user.role === 'team_leader' && user.serverId) {
      const clientUser = await User.findById(user.serverId).select('+properties.smoobuApiKey');
      if (clientUser?.properties?.length) {
        user.properties = clientUser.properties;
      }
    }

    if (!user.isVerified && !user.mustChangePassword) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    req.user    = user;
    req.userId  = String(user._id);
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
  if (req.isStaff || req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── requireAdminOrTeamLeader ──────────────────────────────────────
export function requireAdminOrTeamLeader(req, res, next) {
  if (req.isStaff) return res.status(403).json({ error: 'Access denied' });
  if (req.user?.role !== 'admin' && req.user?.role !== 'team_leader') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}