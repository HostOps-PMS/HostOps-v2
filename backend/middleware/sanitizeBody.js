// middleware/sanitizeBody.js
// ─────────────────────────────────────────────────────────────────
// Strips dangerous fields from req.body BEFORE any route handler
// runs. Defense-in-depth against mass assignment — even if a Zod
// schema accidentally allows a sensitive field, this middleware
// ensures it never reaches the database layer.
// ─────────────────────────────────────────────────────────────────

const FORBIDDEN_FIELDS = new Set([
  'role',
  'tag',
  'isAdmin',
  'isVerified',
  'isArchive',
  'totpSecret',
  'totpEnabled',
  'backupCodes',
  'password',
  'pin',
  'loginOtp',
  'loginOtpExpiry',
  'pinAttempts',
  'pinLockedUntil',
  'pinPermanentlyLocked',
  'activityLog',
  '__v',
  '_id',
]);

// Routes that are ALLOWED to set restricted fields (admin-only endpoints)
const ADMIN_EXEMPT_PATHS = new Set([
  '/api/clients',       // admin edits client (has its own role-check)
  '/api/staffs',        // admin edits staff
]);

export function sanitizeRequestBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  // Skip for admin-exempt paths (they have their own Zod + role checks)
  const isExempt = ADMIN_EXEMPT_PATHS.has(req.path) ||
    [...ADMIN_EXEMPT_PATHS].some(p => req.path.startsWith(p + '/'));

  if (!isExempt) {
    for (const field of FORBIDDEN_FIELDS) {
      if (field in req.body) {
        delete req.body[field];
      }
    }
  }

  // Always strip these — no endpoint should ever accept them from client
  delete req.body.__proto__;
  delete req.body.constructor;
  delete req.body.prototype;

  next();
}
