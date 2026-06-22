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

// Routes exempt from field stripping (they have their own validation)
const EXEMPT_PREFIXES = [
  '/auth/',             // login, register, change-password, change-pin all need password/pin
  '/api/clients',       // admin edits client (has its own Zod + role-check)
  '/api/staffs',        // admin edits staff
];

export function sanitizeRequestBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  // Skip for exempt paths (they have their own Zod + role checks)
  const isExempt = EXEMPT_PREFIXES.some(p => req.path.startsWith(p));

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
