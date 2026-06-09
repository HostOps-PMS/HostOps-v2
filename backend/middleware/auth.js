// src/middleware/auth.js
import mongoose     from 'mongoose';
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

    // ── 6. Session-ownership check ───────────────────────────────
    // We look up by userId/staffId (NOT accessJti) because the /auth/refresh
    // endpoint issues a new access token with a new jti on every silent
    // refresh (i.e. every page reload). The accessJti stored on the
    // RefreshToken row becomes stale immediately after the first refresh,
    // so matching on it produces a false 403 on the very next API call.
    //
    // The real revocation guard is Step 5 above (RevokedToken jti lookup).
    // This step only confirms that an active, non-expired refresh session
    // still exists for the identity claimed in the access token — preventing
    // access after a logout or session expiry.
    //
    // Staff and regular users are handled separately below (7a / 7b) so each
    // branch can do its own identity-scoped session query.

    // ── 7a. STAFF ────────────────────────────────────────────────
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff)       return res.status(401).json({ error: 'Staff not found' });
      if (!staff.isActive) return res.status(403).json({ error: 'Staff account is inactive' });

      // Find an active session that belongs to this staff member.
      // Cast staff._id to ObjectId explicitly — staffId in RefreshToken schema
      // is ObjectId and Mongoose already handles this, but being explicit here
      // prevents any future type-coercion surprises.
      const owningSession = await RefreshToken.findOne({
        staffId:   new mongoose.Types.ObjectId(String(staff._id)),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!owningSession || !owningSession.isActive()) {
        return res.status(403).json({ error: 'Forbidden: session has been revoked' });
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
    // Find an active session that belongs to the user in the token.
    // decoded.sub is a string (from JWT), but userId in RefreshToken schema is
    // ObjectId. Cast explicitly to avoid a string-vs-ObjectId mismatch where
    // MongoDB returns no results even when a valid session exists, causing a
    // false 403 "session revoked" on every request.
    const owningSession = await RefreshToken.findOne({
      userId:    new mongoose.Types.ObjectId(decoded.sub),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!owningSession || !owningSession.isActive()) {
      return res.status(403).json({ error: 'Forbidden: session has been revoked' });
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