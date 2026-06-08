// src/utils/tokens.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from './encryption.js';


export function encryptToken(rawJwt) {
  return encrypt(rawJwt);
}

export function decryptToken(blob) {
  return decrypt(blob);
}

// ── Access tokens (short-lived, sent on every request) ──────────
// jti (JWT ID) is a unique uuid per token. It lets us revoke
// individual tokens without touching the refresh token family.
export function signAccessToken(user) {
  return jwt.sign(
    {
      jti:   uuidv4(),          // unique token ID for per-token revocation
      sub:   user._id.toString(),
      email: user.email,
      role:  user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

// ── Staff access tokens ──────────────────────────────────────────
export function signStaffAccessToken(staff) {
  return jwt.sign(
    {
      jti:      uuidv4(),
      sub:      staff._id.toString(),
      staffId:  staff._id.toString(),
      clientId: staff.clientId.toString(),
      email:    staff.email,
      role:     'staff',
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

// verifyAccessToken: decrypts the blob first, then verifies the JWT.
// All callers (middleware/auth.js) must use this — never jwt.verify() directly.
export function verifyAccessToken(tokenOrBlob) {
  const raw = decryptToken(tokenOrBlob);   // no-op if already plain (isEncrypted guard)
  return jwt.verify(raw, process.env.JWT_ACCESS_SECRET);
}

// ── Refresh tokens (long-lived, stored in DB) ───────────────────
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

// ── Client Account tokens ─────────────────────────────────────────
export function signClientAccountAccessToken(account) {
  return jwt.sign(
    {
      jti:             uuidv4(),
      sub:             account._id.toString(),
      clientAccountId: account._id.toString(),
      parentClientId:  account.parentClientId.toString(),
      email:           account.email,
      role:            'clientAccount',
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
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

// ── Compute expiry Date object for refresh token ────────────────
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