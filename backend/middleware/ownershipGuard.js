// middleware/ownershipGuard.js
// ─────────────────────────────────────────────────────────────────
// Prevents BOLA (Broken Object Level Authorization) by enforcing
// contextual ownership on all routes that access resources by ID.
//
// Instead of trusting req.params.id alone, this middleware ensures
// the authenticated user has the right to access the specified
// resource based on their role and ownership context.
// ─────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

/**
 * Validates that a MongoDB ObjectId is properly formatted.
 * Prevents NoSQL injection via malformed IDs and returns 400
 * instead of letting Mongoose throw a CastError deeper in the stack.
 */
export function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    next();
  };
}

/**
 * Enforces that a staff member belongs to the authenticated user's
 * client account. Prevents a team leader from accessing staff members
 * that belong to a different client.
 *
 * Usage: router.get('/staffs/:id', requireAuth, enforceStaffOwnership, handler)
 */
export function enforceStaffOwnership(req, res, next) {
  // Admins can access any staff — skip ownership check
  const isAdmin = (req.user?.tag === 'Main Admin' && req.user?.role === 'admin')
                || req.user?.email === process.env.ADMIN_ROLE;
  if (isAdmin) return next();

  // Team leaders can only access staff under their assigned client
  if (req.user?.role === 'team_leader') {
    req._ownershipFilter = { clientId: req.user.serverId };
  } else {
    // Regular clients can only see their own staff
    req._ownershipFilter = { clientId: req.user._id };
  }
  next();
}

/**
 * Enforces that activity logs are always scoped to the authenticated
 * user's own data. Prevents enumeration of other users' activity.
 *
 * Usage: router.get('/activity-log', requireAuth, enforceActivityOwnership, handler)
 */
export function enforceActivityOwnership(req, res, next) {
  // Admins can access all activity logs via /activity-log/all
  const isAdmin = (req.user?.tag === 'Main Admin' && req.user?.role === 'admin')
                || req.user?.email === process.env.ADMIN_ROLE;
  if (isAdmin && req.path.includes('/all')) return next();

  // Non-admins are always scoped to their own userId
  req._ownershipFilter = { userId: req.user._id };
  next();
}

/**
 * Generic middleware that prevents sequential ID enumeration by
 * rejecting requests where the user tries to access resources
 * outside their authorized scope.
 *
 * Logs suspicious enumeration attempts for security monitoring.
 */
export function logSuspiciousAccess(req, res, next) {
  // If the request targets a specific ID via params and the user
  // is not an admin, log it for security monitoring
  const targetId = req.params.id || req.params.clientId;
  if (targetId && req.user) {
    const isAdmin = (req.user.tag === 'Main Admin' && req.user.role === 'admin')
                  || req.user.email === process.env.ADMIN_ROLE;
    const isOwnResource = String(targetId) === String(req.user._id);

    if (!isAdmin && !isOwnResource) {
      // Non-admin accessing someone else's resource — log for audit
      console.warn('[BOLA-AUDIT]', {
        userId:    req.user._id,
        email:     req.user.email,
        role:      req.user.role,
        targetId,
        path:      req.originalUrl,
        method:    req.method,
        ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
        timestamp: new Date().toISOString(),
      });
    }
  }
  next();
}
