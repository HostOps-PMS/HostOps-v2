// src/middleware/auth.js
import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/user.js';
import Staff from '../models/staff.js';
import ClientAccount from '../models/clientAccount.js';

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
      req.isClientAccount = false;
      // Normalise propertyIds to strings for comparison — Smoobu IDs are
      // numbers but the Staff schema stores them as strings.
      req.staffPropertyIds = (staff.propertyIds || []).map(String);

      return next();
    }

    // ── CLIENT ACCOUNT LOGIN ───────────────────────────────────────
    // Sub-accounts linked to a parent client. Token carries role: 'clientAccount'
    // and parentClientId. We load the parent client's User record (with
    // smoobuApiKey) so all Smoobu service calls work identically to a
    // regular client session. No property filtering — client accounts
    // have access to all of the parent's properties.
    if (decoded.role === 'clientAccount') {
      const clientAccount = await ClientAccount.findById(decoded.clientAccountId || decoded.sub);
      if (!clientAccount) return res.status(401).json({ error: 'Client account not found' });
      if (!clientAccount.isActive) return res.status(403).json({ error: 'Client account is inactive' });

      // Load the parent client WITH smoobuApiKey so Smoobu calls work.
      const parentUser = await User.findById(clientAccount.parentClientId).select('+smoobuApiKey');
      if (!parentUser) return res.status(401).json({ error: 'Parent client not found' });

      // req.user = parent client (carries smoobuApiKey for Smoobu calls)
      // req.clientAccount = the sub-account record itself
      req.user            = parentUser;
      req.clientAccount   = clientAccount;
      req.isStaff         = false;
      req.isClientAccount = true;
      // Empty array signals "all properties" — properties.js checks this
      req.staffPropertyIds = [];

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

    // For team leaders, dynamically inject their assigned client's (serverId) Smoobu API key in memory.
    // This allows them to fetch properties and view dashboards without duplicating the key in the database.
    if (user.role === 'team_leader' && user.serverId) {
      const clientUser = await User.findById(user.serverId).select('+smoobuApiKey');
      if (clientUser && clientUser.smoobuApiKey) {
        user.smoobuApiKey = clientUser.smoobuApiKey;
      }
    }

    // Allow through if the user must change their password (admin-created account).
    // They are not yet verified, but the /auth/change-password endpoint
    // needs to be accessible so they can complete the first-login flow.
    if (!user.isVerified && !user.mustChangePassword) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    req.user            = user;
    req.isStaff         = false;
    req.isClientAccount = false;
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
  // Staff members and client accounts are never admins
  if (req.isStaff || req.isClientAccount) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireAdminOrTeamLeader(req, res, next) {
  if (req.isStaff || req.isClientAccount) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user?.role !== 'admin' && req.user?.role !== 'team_leader') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}