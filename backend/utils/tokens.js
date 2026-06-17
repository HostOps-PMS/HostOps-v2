// src/utils/tokens.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from './encryption.js';

// ── Rotating Secret Helpers ──────────────────────────────────────
// Three secrets rotate every hour: PREV → CURR → NEXT.
// Tokens are always SIGNED with CURR.
// Verification tries CURR first, then PREV and NEXT as fallback.
//
// This means a stolen token is useless within ≤1 hour — once the
// hourly rotation script runs, that secret slot becomes PREV, then
// on the next rotation it's gone entirely. A token captured right
// before a rotation has at most ~1h of residual validity.
//
// ENV VARS REQUIRED (set by scripts/rotateSecrets.js):
//   JWT_SECRET_PREV   — previous hour's signing secret
//   JWT_SECRET_CURR   — current hour's signing secret  (used to sign)
//   JWT_SECRET_NEXT   — next hour's signing secret     (pre-generated)
//
// LEGACY FALLBACK:
//   If JWT_SECRET_CURR is missing we fall back to JWT_ACCESS_SECRET
//   so existing deployments don't break before they run the rotation
//   script for the first time.

function getSigningSecret() {
  const secret = process.env.JWT_SECRET_CURR || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('No JWT signing secret configured (JWT_SECRET_CURR or JWT_ACCESS_SECRET)');
  return secret;
}

function getVerificationSecrets() {
  // Order matters: try CURR first (happy path, ~99% of calls),
  // then PREV (tokens issued just before a rotation), then NEXT
  // (tokens issued slightly ahead of a rotation, edge case).
  const secrets = [
    process.env.JWT_SECRET_CURR,
    process.env.JWT_SECRET_PREV,
    process.env.JWT_SECRET_NEXT,
    // Legacy fallback — kept so tokens signed before the rotation
    // system was enabled still work until they naturally expire.
    process.env.JWT_ACCESS_SECRET,
  ].filter(Boolean); // remove undefined/empty slots

  if (secrets.length === 0) {
    throw new Error('No JWT verification secrets configured');
  }

  return [...new Set(secrets)]; // deduplicate (e.g. if CURR === JWT_ACCESS_SECRET)
}

// Attempt jwt.verify against each secret in order.
// Returns the decoded payload from the first secret that succeeds.
// Throws the LAST error if all secrets fail (preserves TokenExpiredError etc.).
function verifyWithRotation(raw) {
  const secrets = getVerificationSecrets();
  let lastErr;

  for (const secret of secrets) {
    try {
      return jwt.verify(raw, secret);
    } catch (err) {
      lastErr = err;
      // TokenExpiredError means the signature DID match — the token is
      // just old. No point trying other secrets; surface the real error.
      if (err.name === 'TokenExpiredError') throw err;
    }
  }

  throw lastErr;
}

// ── Encryption helpers (re-exports for convenience) ─────────────
export function encryptToken(rawJwt) {
  return encrypt(rawJwt);
}

export function decryptToken(blob) {
  return decrypt(blob);
}

// ── Session fingerprint ──────────────────────────────────────────
// SHA-256 of user-agent + accept-language + accept-encoding.
// No IP binding — fingerprint survives mobile network switches.
// Exported so middleware can re-derive and compare on every request.
export function generateFingerprint(req) {
  const ua   = req.get('user-agent')      || '';
  const lang = req.get('accept-language') || '';
  const enc  = req.get('accept-encoding') || '';
  return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}`).digest('hex');
}

// ── Access tokens (short-lived, sent on every request) ──────────
// jti (JWT ID) is a unique uuid per token. It lets us revoke
// individual tokens without touching the refresh token family.
// req is optional — when provided, embeds a session fingerprint (fp)
// derived from browser headers. Tokens without fp skip the check.
export function signAccessToken(user, req = null) {
  const payload = {
    jti:   uuidv4(),
    sub:   user._id.toString(),
    email: user.email,
    role:  user.role,
    tag:   user.tag || '',
  };
  if (req) payload.fp = generateFingerprint(req);
  return jwt.sign(payload, getSigningSecret(), { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
}

// ── Staff access tokens ──────────────────────────────────────────
export function signStaffAccessToken(staff, req = null) {
  const payload = {
    jti:      uuidv4(),
    sub:      staff._id.toString(),
    staffId:  staff._id.toString(),
    clientId: staff.clientId.toString(),
    email:    staff.email,
    role:     'staff',
  };
  if (req) payload.fp = generateFingerprint(req);
  return jwt.sign(payload, getSigningSecret(), { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
}

// verifyAccessToken: decrypts the blob first, then verifies the JWT
// against all three rotating secrets.
// All callers (middleware/auth.js) must use this — never jwt.verify() directly.
export function verifyAccessToken(tokenOrBlob) {
  const raw = decryptToken(tokenOrBlob); // no-op if already plain (isEncrypted guard)
  return verifyWithRotation(raw);
}

// ── Refresh tokens (long-lived, stored in DB) ───────────────────
// Refresh tokens use their own separate secret (JWT_REFRESH_SECRET)
// and are NOT part of the access-token rotation — they are long-lived
// and verified once at /auth/refresh, where the DB row is also checked.
export function signRefreshToken(user) {
  return jwt.sign(
    {
      jti: uuidv4(),
      sub: user._id.toString(),
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

// ── Staff refresh tokens ─────────────────────────────────────────
export function signStaffRefreshToken(staff) {
  return jwt.sign(
    {
      jti:      uuidv4(),
      sub:      staff._id.toString(),
      staffId:  staff._id.toString(),
      clientId: staff.clientId.toString(),
      role:     'staff',
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

// ── Client Account tokens ────────────────────────────────────────
export function signClientAccountAccessToken(account, req = null) {
  const payload = {
    jti:             uuidv4(),
    sub:             account._id.toString(),
    clientAccountId: account._id.toString(),
    parentClientId:  account.parentClientId.toString(),
    email:           account.email,
    role:            'clientAccount',
  };
  if (req) payload.fp = generateFingerprint(req);
  return jwt.sign(payload, getSigningSecret(), { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
}

export function signClientAccountRefreshToken(account) {
  return jwt.sign(
    {
      jti:             uuidv4(),
      sub:             account._id.toString(),
      clientAccountId: account._id.toString(),
      parentClientId:  account.parentClientId.toString(),
      role:            'clientAccount',
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

export function verifyRefreshToken(tokenOrBlob) {
  const raw = decryptToken(tokenOrBlob); // no-op if already plain (isEncrypted guard)
  return jwt.verify(raw, process.env.JWT_REFRESH_SECRET);
}

// ── Compute expiry Date object for refresh token ─────────────────
export function refreshTokenExpiry() {
  const raw = process.env.JWT_REFRESH_EXPIRES || '7d';
  const ms = parseDuration(raw);
  return new Date(Date.now() + ms);
}

function parseDuration(str) {
  const match = String(str).match(/^(\d+(\.\d+)?)\s*(d|h|m|s)?$/i);
  if (!match) {
    console.warn(`[tokens] Could not parse JWT_REFRESH_EXPIRES="${str}", defaulting to 7d`);
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = parseFloat(match[1]);
  const unit  = (match[3] || 'd').toLowerCase();
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return value * (multipliers[unit] ?? multipliers.d);
}

// ── Random tokens (verify, reset) ───────────────────────────────
export function randomToken() {
  return crypto.randomInt(100000, 999999).toString();
}

// ── Hash token for DB storage ────────────────────────────────────
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}