// src/utils/tokens.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ── Access tokens (short-lived, sent on every request) ──────────
export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// ── Refresh tokens (long-lived, stored in DB) ───────────────────
export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// ── Compute expiry Date object for refresh token ────────────────
// Parses values like '7d', '30d', '24h', '60m', or plain numbers (treated as days).
export function refreshTokenExpiry() {
  const raw = process.env.JWT_REFRESH_EXPIRES || '7d';
  const ms = parseDuration(raw);
  return new Date(Date.now() + ms);
}

/**
 * Parses a duration string into milliseconds.
 * Supports: '7d', '24h', '60m', '30s', or a plain number (treated as days).
 */
function parseDuration(str) {
  const match = String(str).match(/^(\d+(\.\d+)?)\s*(d|h|m|s)?$/i);
  if (!match) {
    // Fallback: 7 days
    console.warn(`[tokens] Could not parse JWT_REFRESH_EXPIRES="${str}", defaulting to 7d`);
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseFloat(match[1]);
  const unit  = (match[3] || 'd').toLowerCase();

  const multipliers = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };

  return value * (multipliers[unit] ?? multipliers.d);
}

// ── Random tokens (verify, reset) ───────────────────────────────
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ── Hash token for DB storage (so DB compromise ≠ token leak) ──
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}