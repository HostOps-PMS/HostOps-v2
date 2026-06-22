// src/routes/auth.js
import express from 'express';
import honeypotGateway from '../middleware/honeypotGateway.js';
import { createSessionKey, deleteSessionKey } from '../utils/responseEncryption.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/user.js';
import Staff from '../models/staff.js';
import RefreshToken from '../models/refreshToken.js';
import RevokedToken from '../models/revokedToken.js';
import TrustedDevice from '../models/trustedDevice.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signStaffAccessToken,
  signStaffRefreshToken,
  refreshTokenExpiry,
  randomToken,
  hashToken,
  encryptToken,
  decryptToken,
  verifyAccessToken,
} from '../utils/tokens.js';
import { sendVerificationEmail, sendResetEmail } from '../services/email.js';
import { requireAuth } from '../middleware/auth.js';
import ActivityLog from '../models/activityLog.js';

const router = express.Router();

// ── Helper: build image proxy URL ────────────────────────────────
// Replaces raw Cloudinary URLs with our backend proxy endpoint.
// The client never sees the real Cloudinary URL in any response.
//
// IMPORTANT: Must return an ABSOLUTE URL (with origin) so that
// <img> tags on the frontend (different origin) can load the image.
// A relative URL like "/api/image/..." would resolve to the *frontend*
// origin, not the backend, causing a 404.
//
// Priority:
//   1. API_BASE_URL env var  (e.g. "https://api.hostops.online")
//   2. RENDER_EXTERNAL_URL   (set automatically on Render.com deployments)
//   3. Fallback to hardcoded production URL — change this if your backend
//      URL is different.
const API_BASE_INTERNAL = (
  process.env.API_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://api.hostops.online'
).replace(/\/$/, ''); // strip trailing slash

function proxyImageUrl(userId, propertyId) {
  return `${API_BASE_INTERNAL}/api/image/property/${userId}/${propertyId}`;
}

// ── Helper: strip sensitive fields before sending user to client ─
// Never send activityLog, pin state, crop data, or internal IDs
// in auth responses. Only the minimum the frontend actually needs.
function sanitizeUser(user) {
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  return {
    _id:                obj._id,
    email:              obj.email,
    firstName:          obj.firstName,
    lastName:           obj.lastName,
    businessName:       obj.businessName,
    role:               obj.role,
    // tag is intentionally omitted — never expose Main Admin identity
    isVerified:         obj.isVerified,
    mustChangePassword: obj.mustChangePassword,
    mustChangePin:      obj.mustChangePin,
    propertyTagPrefix:  obj.propertyTagPrefix,
    serverId:           obj.serverId,
    totpEnabled:        obj.totpEnabled || false,
    profileImage:       obj.profileImage || '',
    allowAdminRememberMe: obj.allowAdminRememberMe ?? true,
    // propertyPicture is replaced with proxy URL —
    // the real Cloudinary URL never leaves the server.
    properties: (obj.properties || []).map(p => ({
      _id:             p._id,
      propertyName:    p.propertyName,
      propertyPicture: p.propertyPicture
        ? proxyImageUrl(obj._id, p._id)
        : '',
    })),
  };
}

function sanitizeStaff(staff) {
  const obj = typeof staff.toJSON === 'function' ? staff.toJSON() : { ...staff };
  return {
    _id:                obj._id,
    email:              obj.email,
    firstName:          obj.firstName,
    lastName:           obj.lastName,
    role:               'staff',
    isStaff:            true,
    clientId:           obj.clientId?.toString(),
    mustChangePassword: obj.mustChangePassword,
    mustChangePin:      obj.mustChangePin,
    isActive:           obj.isActive,
    propertyIds:        obj.propertyIds,
  };
}

// ── Helper: compute access token expiry in ms ────────────────────
function accessTokenExpiryMs() {
  const raw = process.env.JWT_ACCESS_EXPIRES || '15m';
  const match = String(raw).match(/^(\d+(\.\d+)?)\s*(d|h|m|s)?$/i);
  if (!match) return 15 * 60 * 1000;
  const val  = parseFloat(match[1]);
  const unit = (match[3] || 'm').toLowerCase();
  const map  = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return val * (map[unit] ?? map.m);
}

// ── Helper: revoke an access token jti ──────────────────────────
async function revokeAccessJti(jti, userId, reason = 'logout') {
  if (!jti) return;
  const expiresAt = new Date(Date.now() + accessTokenExpiryMs());
  await RevokedToken.updateOne(
    { jti },
    { $setOnInsert: { jti, userId: String(userId), expiresAt, reason } },
    { upsert: true }
  );
}

// ── Helper: extract jti from an encrypted access token ──────────
function extractJti(encryptedOrRaw) {
  try {
    const decoded = verifyAccessToken(encryptedOrRaw);
    return decoded?.jti || null;
  } catch {
    return null;
  }
}

// ── Helper: issue an access+refresh token pair atomically ────────
// Signs both tokens, stores the refresh token in DB with the access
// token's jti bound to it (accessJti), then returns both.
async function issueTokenPair(signFnAccess, signFnRefresh, entity, req, extra = {}) {
  const rawAccess  = signFnAccess(entity, req);
  const rawRefresh = signFnRefresh(entity);
  const isStaffEntity = !!entity.clientId;

  const { jti: accessJti } = verifyAccessToken(encryptToken(rawAccess));
  await RefreshToken.create({
    userId:    isStaffEntity ? entity.clientId : entity._id,
    staffId:   isStaffEntity ? entity._id : undefined,
    token:     hashToken(rawRefresh),
    expiresAt: refreshTokenExpiry(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    accessJti,
    ...extra,
  });
  return { encAccessToken: encryptToken(rawAccess), rawRefresh, accessJti };
}

// ── Helper: set the encrypted rt cookie ─────────────────────────
// Single place that controls cookie options so they stay consistent.
// Detects HTTPS from the actual connection or reverse-proxy header (x-forwarded-proto),
// NOT from NODE_ENV. Render.com always terminates TLS at the load balancer and
// forwards plain HTTP to the app with x-forwarded-proto=https — so NODE_ENV-based
// detection incorrectly treats a production HTTPS request as HTTP when NODE_ENV is
// not set to 'production', producing SameSite=lax cookies that cross-origin POSTs
// (e.g. localhost dev → render.com) cannot send.
function setRefreshCookie(res, rawRefreshToken, req) {
  const isHttps = req
    ? (req.secure || req.get('x-forwarded-proto') === 'https')
    : process.env.NODE_ENV === 'production';
  // COOKIE_SAME_SITE controls cross-origin vs same-site behaviour:
  //   'none' — required while frontend and API are on different origins (cross-site)
  //   'lax'  — use once both are on the same eTLD+1 (same-site)
  // Defaults to 'none' for HTTPS so cross-origin requests (localhost dev, different
  // subdomains) can send the cookie. SameSite=none requires Secure=true, which is
  // automatically true whenever the connection is HTTPS.
  const sameSite = isHttps ? (process.env.COOKIE_SAME_SITE || 'none') : 'lax';
  res.cookie('rt', encryptToken(rawRefreshToken), {
    httpOnly: true,
    secure:   isHttps,
    sameSite,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/auth',
  });
}

// ── Helper: clear the rt cookie (must mirror setRefreshCookie attributes) ──
// clearCookie() sends a Set-Cookie with Expires in the past. On HTTPS/cross-site
// the browser only accepts it if SameSite=None; Secure are present — exactly as
// when the cookie was first set. Omitting them leaves the old cookie in place,
// so the next /auth/refresh sends a DB-revoked token → reuse-attack → 401.
function clearRefreshCookie(res, req) {
  const isHttps = req
    ? (req.secure || req.get('x-forwarded-proto') === 'https')
    : process.env.NODE_ENV === 'production';
  const sameSite = isHttps ? (process.env.COOKIE_SAME_SITE || 'none') : 'lax';
  res.clearCookie('rt', {
    httpOnly: true,
    secure:   isHttps,
    sameSite,
    path:     '/auth',
  });
}

// ── Helper: read + decrypt the rt cookie ────────────────────────
// Returns the raw (decrypted) refresh token string, or null.
function getRefreshCookie(req) {
  const blob = req.cookies?.rt;
  if (!blob) return null;
  return decryptToken(blob); // no-op if somehow already plain
}

// Validation schemas
const registerSchema = z.object({
  email:             z.string().email().max(254),
  password:          z.string().min(8).max(128),
  firstName:         z.string().min(1).max(50),
  lastName:          z.string().max(50).optional().default(''),
  propertyTagPrefix: z.string().optional().default(''),
  smoobuApiKey:      z.string().max(512).optional().default(''),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const rawToken = randomToken();
    const hashed   = hashToken(rawToken);

    // ── SECURITY: Hardcode role to 'client' ────────────────────────
    // Even though the Zod schema above strips unknown fields, we
    // explicitly set role here as defense-in-depth. An attacker who
    // somehow bypasses validation can never escalate to admin/team_leader
    // through the public registration endpoint.
    const user = await User.create({
      email:             data.email.toLowerCase(),
      password:          data.password,
      firstName:         data.firstName,
      lastName:          data.lastName || '',
      businessName:      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || data.firstName,
      propertyTagPrefix: data.propertyTagPrefix || '',
      smoobuApiKey:      data.smoobuApiKey || null,
      role:              'client',   // ← forced, never from request
      tag:               '',         // ← forced, never from request
      isVerified:        false,
      verifyToken:       hashed,
      verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const contactWebhookUrl = process.env.GHL_CONTACT_WEBHOOK_URL;
    if (contactWebhookUrl) {
      try {
        await fetch(contactWebhookUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: user.email, first_name: user.firstName, last_name: user.lastName }),
        });
      } catch (err) {
        console.error('Failed to trigger GHL Contact webhook:', err);
      }
    }

    try {
      await sendVerificationEmail(user.email, user.firstName || user.businessName, rawToken);
    } catch (e) {
      console.error('Email send failed:', e);
    }

    res.status(201).json({ message: 'Account created. Please check your email to verify.', userId: user._id });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify
// ─────────────────────────────────────────────────────────────────
router.post('/verify', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token required' });

    const hashed = hashToken(token);
    const user   = await User.findOne({
      email:             email.toLowerCase(),
      verifyToken:       hashed,
      verifyTokenExpiry: { $gt: new Date() },
    }).select('+verifyToken +verifyTokenExpiry');

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.isVerified        = true;
    user.verifyToken       = undefined;
    user.verifyTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────────
router.post('/login', honeypotGateway, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { email, password, deviceId } = data;

    // ── 1. Try Staff login first ──────────────────────────────────
    const staff = await Staff.findOne({ email: email.toLowerCase() });
    if (staff) {
      if (staff.isArchive) {
        return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });
      }
      if (!staff.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
      }

      const { encAccessToken, rawRefresh, accessJti } = await issueTokenPair(
        signStaffAccessToken, signStaffRefreshToken, staff, req
      );

      staff.lastLoginAt = new Date();
      await staff.save();

      setRefreshCookie(res, rawRefresh, req);
      const staffSk = createSessionKey(accessJti, accessTokenExpiryMs());

      return res.json({
        accessToken:        encAccessToken,
        staff:              sanitizeStaff(staff),
        mustChangePassword: staff.mustChangePassword,
        mustChangePin:      staff.mustChangePin,
        isStaff:            true,
        ...(staffSk ? { sk: staffSk } : {}),
      });
    }

    // ── 2. Try User login ─────────────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    const userPasswordMatch = user && (await user.comparePassword(password));

    if (!userPasswordMatch) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.isArchive) {
      return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });
    }

    const isAdminCreated = user.mustChangePassword === true;
    if (!user.isVerified && !isAdminCreated) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const isAdmin = (user.tag === 'Main Admin' && user.role === 'admin') || user.email === process.env.ADMIN_ROLE;
    let isTrusted = false;

    // Check trusted device for both admins and regular users
    if (deviceId) {
      if (!isAdmin || user.allowAdminRememberMe !== false) {
        const trusted = await TrustedDevice.findOne({ userId: user._id, deviceId, expiresAt: { $gt: new Date() } });
        if (trusted) isTrusted = true;
      }
    }

    if (!isAdmin && !isTrusted) {
      const rawOtp = randomToken();
      user.loginOtp       = hashToken(rawOtp);
      user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try { await sendVerificationEmail(user.email, user.firstName || user.businessName, rawOtp); }
      catch (e) { console.error('Login OTP email send failed:', e); }

      return res.json({ requiresOtp: true, totpEnabled: user.totpEnabled || false });
    }

    // ── Always issue a fresh token pair on login ──────────────────
    // We never reuse an old rt cookie here. Every login produces a
    // new access token with a new jti, bound to a new RefreshToken
    // row. This ensures the session ownership check in middleware
    // always has a valid, current accessJti to verify against.
    if (deviceId) {
      await RefreshToken.updateMany(
        { userId: user._id, deviceId, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    const { encAccessToken, rawRefresh: refreshTokenToUse, accessJti: userLoginJti } = await issueTokenPair(
      signAccessToken, signRefreshToken, user, req,
      { deviceId: deviceId || undefined }
    );

    user.lastLoginAt = new Date();
    user.activityLog = user.activityLog || [];
    user.activityLog.push({
      action:      'login',
      ipAddress:   req.ip || '',
      userAgent:   req.get('user-agent') || '',
      timestamp:   new Date(),
      performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
    });
    if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
    await user.save();

    setRefreshCookie(res, refreshTokenToUse, req);
    const userSk = createSessionKey(userLoginJti, accessTokenExpiryMs());
    res.json({ accessToken: encAccessToken, user: sanitizeUser(user), isAdmin, isTrustedDevice: isTrusted, ...(userSk ? { sk: userSk } : {}) });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/staff-login
// ─────────────────────────────────────────────────────────────────
router.post('/staff-login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+password');
    if (!staff || !(await staff.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (staff.isArchive) {
      return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });
    }
    if (!staff.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
    }

    const { encAccessToken, rawRefresh, accessJti: staffLoginJti } = await issueTokenPair(
      signStaffAccessToken, signStaffRefreshToken, staff, req
    );

    staff.lastLoginAt = new Date();
    await staff.save();

    setRefreshCookie(res, rawRefresh, req);
    const staffLoginSk = createSessionKey(staffLoginJti, accessTokenExpiryMs());

    res.json({
      accessToken:        encAccessToken,
      staff:              sanitizeStaff(staff),
      mustChangePassword: staff.mustChangePassword,
      mustChangePin:      staff.mustChangePin,
      ...(staffLoginSk ? { sk: staffLoginSk } : {}),
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-login-otp
// ─────────────────────────────────────────────────────────────────
router.post('/verify-login-otp', async (req, res, next) => {
  try {
    const { email, otp, deviceId, rememberMe } = req.body;
    if (!email || !otp || !deviceId) return res.status(400).json({ error: 'Missing required fields' });

    const normalizedEmail = email.toLowerCase();
    const hashedOtp       = hashToken(otp);
    const now             = new Date();

    const user = await User.findOne({
      email:          normalizedEmail,
      loginOtp:       hashedOtp,
      loginOtpExpiry: { $gt: now },
    }).select('+loginOtp +loginOtpExpiry');

    if (user) {
      if (user.isArchive) {
        return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });
      }

      user.loginOtp       = undefined;
      user.loginOtpExpiry = undefined;

      const isAdmin = (user.tag === 'Main Admin' && user.role === 'admin') || user.email === process.env.ADMIN_ROLE;
      if (rememberMe && (!isAdmin || user.allowAdminRememberMe !== false)) {
        // Admin gets 7 days, regular user gets 14 days
        const trustedDays = isAdmin ? 7 : 14;
        const expiresAt = new Date(Date.now() + trustedDays * 24 * 60 * 60 * 1000);
        await TrustedDevice.findOneAndUpdate(
          { userId: user._id, deviceId },
          { expiresAt },
          { upsert: true, new: true }
        );
      }

      if (deviceId) {
        await RefreshToken.updateMany(
          { userId: user._id, deviceId, revokedAt: null },
          { revokedAt: new Date() }
        );
      }

      const { encAccessToken, rawRefresh, accessJti: otpJti } = await issueTokenPair(
        signAccessToken, signRefreshToken, user, req,
        { deviceId: deviceId || undefined }
      );

      user.lastLoginAt = new Date();
      user.activityLog = user.activityLog || [];
      user.activityLog.push({
        action:      'login',
        ipAddress:   req.ip || '',
        userAgent:   req.get('user-agent') || '',
        timestamp:   new Date(),
        performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
      });
      if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
      await user.save();

      setRefreshCookie(res, rawRefresh, req);
      const otpSk = createSessionKey(otpJti, accessTokenExpiryMs());

      return res.json({ accessToken: encAccessToken, user: sanitizeUser(user), isAdmin, ...(otpSk ? { sk: otpSk } : {}) });
    }

    return res.status(401).json({ error: 'Invalid or expired OTP' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/send-login-otp
// ─────────────────────────────────────────────────────────────────
router.post('/send-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const account = await User.findOne({ email: email.toLowerCase() });
    if (!account) return res.json({ message: 'If that email is registered, an OTP has been sent.' });

    const rawOtp = randomToken();
    account.loginOtp       = hashToken(rawOtp);
    account.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await account.save();

    try { await sendVerificationEmail(account.email, account.firstName, rawOtp); }
    catch (e) { console.error('Login OTP email send failed:', e); }

    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/resend-login-otp
// ─────────────────────────────────────────────────────────────────
router.post('/resend-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const account = await User.findOne({ email: email.toLowerCase() });
    if (!account) return res.json({ message: 'If that email is registered, a new code has been sent.' });

    const rawOtp = randomToken();
    account.loginOtp       = hashToken(rawOtp);
    account.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await account.save();

    try { await sendVerificationEmail(account.email, account.firstName, rawOtp); }
    catch (e) { console.error('Login OTP resend failed:', e); }

    res.json({ message: 'If that email is registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/check-trusted-device
// Check if the current device is trusted for the authenticated user.
// Used by the admin panel to skip the OTP gate when the device is
// remembered ("Remember Me" for 7 days).
// ─────────────────────────────────────────────────────────────────
router.post('/check-trusted-device', async (req, res, next) => {
  try {
    const { email, deviceId } = req.body;
    if (!email || !deviceId) return res.status(400).json({ trusted: false });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ trusted: false });

    const isAdmin = (user.tag === 'Main Admin' && user.role === 'admin') || user.email === process.env.ADMIN_ROLE;
    if (isAdmin && user.allowAdminRememberMe === false) {
      return res.json({ trusted: false });
    }

    const trusted = await TrustedDevice.findOne({
      userId: user._id,
      deviceId,
      expiresAt: { $gt: new Date() },
    });

    return res.json({ trusted: !!trusted });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    // Decrypt the rt cookie before doing anything with it
    const rawToken = getRefreshCookie(req);
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });

    let decoded;
    try { decoded = verifyRefreshToken(rawToken); }
    catch { return res.status(401).json({ error: 'Invalid refresh token' }); }

    // Hash the decrypted token to look it up in DB
    const stored = await RefreshToken.findOne({ token: hashToken(rawToken) });
    if (!stored) return res.status(401).json({ error: 'Unauthorized', code: 'RT_NOT_FOUND' });

    // Reuse attack detection: token exists in DB but was already consumed.
    // A legitimately rotated token is always replaced — seeing a revoked one
    // presented again means the old token was leaked. Nuke all active sessions
    // for that identity so the attacker's copy is also invalidated.
    if (stored.revokedAt) {
      console.warn('[auth/refresh] Reuse attack detected — wiping all sessions', {
        userId:    stored.userId,
        revokedAt: stored.revokedAt,
        ip:        req.ip,
        ua:        req.get('user-agent')?.slice(0, 80),
      });
      if (stored.staffId) {
        await RefreshToken.updateMany({ staffId: stored.staffId, revokedAt: null }, { revokedAt: new Date() });
      } else {
        await RefreshToken.updateMany({ userId: stored.userId, staffId: null, revokedAt: null }, { revokedAt: new Date() });
      }
      return res.status(401).json({ error: 'Unauthorized', code: 'RT_REUSE' });
    }

    if (!stored.isActive()) return res.status(401).json({ error: 'Unauthorized', code: 'RT_EXPIRED' });

    // ── Staff refresh ─────────────────────────────────────────────
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff || !staff.isActive) return res.status(401).json({ error: 'Staff account not found or inactive' });
      if (staff.isArchive) return res.status(401).json({ error: 'This account has been disabled.', accountDisabled: true });

      const rawNewAccess   = signStaffAccessToken(staff, req);
      const newRefreshToken = signStaffRefreshToken(staff);
      const { jti: newAccessJti } = verifyAccessToken(encryptToken(rawNewAccess));

      stored.revokedAt  = new Date();
      stored.replacedBy = hashToken(newRefreshToken);
      await stored.save();

      await RefreshToken.create({
        userId:    staff.clientId, 
        staffId:   staff._id,   
        token:     hashToken(newRefreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        accessJti: newAccessJti,
      });

      setRefreshCookie(res, newRefreshToken, req);
      const staffRefreshSk = createSessionKey(newAccessJti, accessTokenExpiryMs());

      return res.json({
        accessToken: encryptToken(rawNewAccess),
        user: sanitizeStaff(staff),
        ...(staffRefreshSk ? { sk: staffRefreshSk } : {}),
      });
    }

    // ── Regular user refresh ──────────────────────────────────────
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isArchive) return res.status(401).json({ error: 'This account has been disabled.', accountDisabled: true });

    const rawNewAccess    = signAccessToken(user, req);
    const newRefreshToken = signRefreshToken(user);
    const { jti: newAccessJti } = verifyAccessToken(encryptToken(rawNewAccess));

    stored.revokedAt  = new Date();
    stored.replacedBy = hashToken(newRefreshToken);
    await stored.save();

    await RefreshToken.create({
      userId:    user._id,
      token:     hashToken(newRefreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      accessJti: newAccessJti,
    });

    setRefreshCookie(res, newRefreshToken, req);
    const userRefreshSk = createSessionKey(newAccessJti, accessTokenExpiryMs());
    res.json({ accessToken: encryptToken(rawNewAccess), ...(userRefreshSk ? { sk: userRefreshSk } : {}) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    // Decrypt rt cookie → hash it → revoke in DB
    const rawToken = getRefreshCookie(req);
    if (rawToken) {
      await RefreshToken.findOneAndUpdate(
        { token: hashToken(rawToken) },
        { revokedAt: new Date() }
      );
    }

    // Revoke access token jti + clean up session key
    const header     = req.headers.authorization || '';
    const accessBlob = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (accessBlob) {
      let decoded = null;
      try { decoded = verifyAccessToken(accessBlob); } catch {}
      const jti = decoded?.jti;
      if (jti) {
        if (decoded?.tag !== 'Main Admin') {
          await revokeAccessJti(jti, req.user?._id || 'unknown', 'logout');
        }
        deleteSessionKey(jti);
      }
    }

    clearRefreshCookie(res, req);
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/revoke-token  (tab-close beacon)
// ─────────────────────────────────────────────────────────────────
router.post('/revoke-token', async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token required' });

    // Revoke ONLY the access token jti.
    // Do NOT touch the refresh token cookie or its DB row.
    //
    // Previously this route also called:
    //   RefreshToken.findOneAndUpdate({ revokedAt: new Date() })
    //   res.clearCookie('rt')
    //
    // That caused redirect-on-refresh: the 'beforeunload'/'pagehide' beacon
    // fired during F5, revoked the rt row, then hydrate() on reload got 401
    // from /auth/refresh → no token → ProtectedRoute redirected to "/".
    //
    // The rt cookie must stay alive so the page can silently re-authenticate
    // after a refresh. It will expire naturally (7 days) or be revoked by
    // POST /auth/logout on intentional sign-out.
    let decoded = null;
    try { decoded = verifyAccessToken(token); } catch {}
    const jti = decoded?.jti;
    if (jti && decoded?.tag !== 'Main Admin') {
      await revokeAccessJti(jti, 'beacon', 'tab_close');
    }

    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  if (req.isStaff && req.staff) {
    return res.json({ user: sanitizeStaff(req.staff) });
  }
  res.json({ user: sanitizeUser(req.user) });
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/log-activity
// ─────────────────────────────────────────────────────────────────
router.post('/log-activity', requireAuth, async (req, res, next) => {
  try {
    const { action, meta = {} } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.activityLog = user.activityLog || [];
    user.activityLog.push({
      action, timestamp: new Date(), ipAddress: req.ip || '', userAgent: req.get('user-agent') || '', meta,
      performedBy: { userId: req.user._id, email: req.user.email, firstName: req.user.firstName || '', lastName: req.user.lastName || '', role: req.user.role || 'client' },
    });
    if (user.activityLog.length > 100) user.activityLog = user.activityLog.slice(-100);
    await user.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/activity-log
// ─────────────────────────────────────────────────────────────────
router.get('/activity-log', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('activityLog');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ activityLog: (user.activityLog || []).slice().reverse() });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/my-properties
// ─────────────────────────────────────────────────────────────────
function staffCanAccessEmbeddedProperty(staff, property) {
  if (!staff || !property) return false;
  const assignedIds = new Set((staff.propertyIds || []).map(String));
  if (assignedIds.size === 0) return false;
  if (assignedIds.has(String(property._id))) return true;
  return (property.subProperties || []).some((sub) => assignedIds.has(String(sub.smoobuId)));
}

router.get('/my-properties', requireAuth, (req, res) => {
  const list   = (req.user.properties || []);
  const userId = String(req.isStaff ? req.staff.clientId : req.user._id);
  res.json({
    businessName: req.user.businessName || '',
    properties:   list.map((p) => ({
      _id:             p._id,
      propertyName:    p.propertyName,
      // Proxy URL — Cloudinary URL stays server-side only
      propertyPicture: p.propertyPicture
        ? proxyImageUrl(userId, p._id)
        : '',
      businessName:    req.user.businessName || '',
      hasAccess:       req.isStaff ? staffCanAccessEmbeddedProperty(req.staff, p) : true,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/change-password
// ─────────────────────────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8).max(128),
    }).parse(req.body);

    // ── Staff ──────────────────────────────────────────────────────
    if (req.isStaff) {
      const staff = await Staff.findById(req.staff._id).select('+password');
      if (!staff) return res.status(404).json({ error: 'Staff not found' });

      const isMatch = await staff.comparePassword(currentPassword);
      if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
      if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different' });

      staff.password           = newPassword;
      staff.mustChangePassword = false;
      await staff.save();

      await RefreshToken.updateMany({ staffId: staff._id, revokedAt: null }, { revokedAt: new Date() });

      const header     = req.headers.authorization || '';
      const accessBlob = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (accessBlob) {
        const jti = extractJti(accessBlob);
        if (jti) await revokeAccessJti(jti, staff._id, 'password_change');
      }

      // Issue a fresh token pair so that a pending mustChangePin step
      // can complete without the user having to log in again.
      const { encAccessToken, rawRefresh, accessJti } = await issueTokenPair(
        signStaffAccessToken, signStaffRefreshToken, staff, req
      );
      setRefreshCookie(res, rawRefresh, req);
      const staffSk = createSessionKey(accessJti, accessTokenExpiryMs());
      deleteSessionKey(req._jti);

      return res.json({
        message:     'Password changed successfully.',
        staff:       sanitizeStaff(staff),
        accessToken: encAccessToken,
        ...(staffSk ? { sk: staffSk } : {}),
      });
    }

    // ── Regular user ───────────────────────────────────────────────
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different' });

    user.password = newPassword;
    if (user.mustChangePassword) { user.mustChangePassword = false; user.isVerified = true; }

    user.activityLog = user.activityLog || [];
    user.activityLog.push({ action: 'password_changed', ipAddress: req.ip || '', userAgent: req.get('user-agent') || '' });
    if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
    await user.save();

    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

    const header     = req.headers.authorization || '';
    const accessBlob = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (accessBlob) {
      const jti = extractJti(accessBlob);
      if (jti) await revokeAccessJti(jti, user._id, 'password_change');
    }

    // Issue a fresh token pair so that a pending mustChangePin step
    // can complete without the user having to log in again.
    const { encAccessToken, rawRefresh, accessJti } = await issueTokenPair(
      signAccessToken, signRefreshToken, user, req
    );
    setRefreshCookie(res, rawRefresh, req);
    const userSk = createSessionKey(accessJti, accessTokenExpiryMs());
    deleteSessionKey(req._jti);

    res.json({
      message:     'Password changed successfully.',
      user:        sanitizeUser(user),
      accessToken: encAccessToken,
      ...(userSk ? { sk: userSk } : {}),
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/change-pin
// ─────────────────────────────────────────────────────────────────
router.post('/change-pin', requireAuth, async (req, res, next) => {
  try {
    const { currentPin, newPin } = z.object({
      currentPin: z.string().min(1, 'Current PIN is required'),
      newPin:     z.string().regex(/^\d{6}$/, 'New PIN must be exactly 6 digits'),
    }).parse(req.body);

    if (req.isStaff) {
      const staff = await Staff.findById(req.staff._id).select('+pin');
      if (!staff) return res.status(404).json({ error: 'Staff not found' });

      const isMatch = await bcrypt.compare(String(currentPin), staff.pin || '');
      if (!isMatch) return res.status(401).json({ error: 'Current PIN is incorrect' });
      if (currentPin === newPin) return res.status(400).json({ error: 'New PIN must be different' });

      staff.pin           = newPin;
      staff.mustChangePin = false;
      await staff.save();

      return res.json({ message: 'PIN changed successfully.', staff: sanitizeStaff(staff) });
    }

    const user = await User.findById(req.user._id).select('+pin');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(String(currentPin), user.pin || '');
    if (!isMatch) return res.status(401).json({ error: 'Current PIN is incorrect' });
    if (currentPin === newPin) return res.status(400).json({ error: 'New PIN must be different' });

    user.pin = newPin;
    if (user.mustChangePin) user.mustChangePin = false;

    user.activityLog = user.activityLog || [];
    user.activityLog.push({ action: 'pin_changed', ipAddress: req.ip || '', userAgent: req.get('user-agent') || '' });
    if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
    await user.save();

    res.json({ message: 'PIN changed successfully.', user: sanitizeUser(user) });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /auth/profile
// ─────────────────────────────────────────────────────────────────
router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const data = z.object({
      firstName:         z.string().min(1).max(50).trim(),
      lastName:          z.string().max(50).trim().optional().default(''),
      propertyTagPrefix: z.string().max(100).trim().optional().default(''),
    }).parse(req.body);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.firstName         = data.firstName;
    user.lastName          = data.lastName ?? '';
    user.businessName      = [data.firstName, data.lastName ?? ''].filter(Boolean).join(' ').trim() || data.firstName;
    user.propertyTagPrefix = data.propertyTagPrefix ?? '';
    await user.save();

    res.json({ message: 'Profile updated successfully.', user: sanitizeUser(user) });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /auth/admin-remember-me
// Toggles the allowAdminRememberMe setting.
// ─────────────────────────────────────────────────────────────────
router.patch('/admin-remember-me', requireAuth, async (req, res, next) => {
  try {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isAdmin = (user.tag === 'Main Admin' && user.role === 'admin') || user.email === process.env.ADMIN_ROLE;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    user.allowAdminRememberMe = enabled;
    await user.save();

    // Clear trusted devices if disabled
    if (!enabled) {
      await TrustedDevice.deleteMany({ userId: user._id });
    }

    res.json({ message: 'Setting updated successfully.', user: sanitizeUser(user) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /auth/smoobu-key
// ─────────────────────────────────────────────────────────────────
router.patch('/smoobu-key', requireAuth, async (req, res, next) => {
  try {
    const { smoobuApiKey } = req.body;
    if (!smoobuApiKey || typeof smoobuApiKey !== 'string' || !smoobuApiKey.trim()) {
      return res.status(400).json({ error: 'smoobuApiKey is required' });
    }
    const user = await User.findById(req.user._id).select('+smoobuApiKey');
    user.smoobuApiKey      = smoobuApiKey.trim();
    user.smoobuConnectedAt = new Date();
    await user.save();
    res.json({ message: 'Smoobu API key updated successfully.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/forgot-password
// ─────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();
    const rawToken = randomToken();

    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.resetToken       = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      try { await sendResetEmail(user.email, user.firstName || user.businessName, rawToken); }
      catch (e) { console.error('Reset email send failed:', e); }
      return res.json({ message: 'If that email is registered, a reset code has been sent.' });
    }

    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      staff.loginOtp       = hashToken(rawToken);
      staff.loginOtpExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await staff.save();
      try { await sendVerificationEmail(staff.email, staff.firstName, rawToken); }
      catch (e) { console.error('Staff reset OTP email send failed:', e); }
    }

    res.json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/reset-password
// ─────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findOne({
      email:            email.toLowerCase(),
      resetToken:       hashToken(token),
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password         = newPassword;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    res.json({ message: 'Password reset. Please log in with your new password.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-reset-token
// ─────────────────────────────────────────────────────────────────
router.post('/verify-reset-token', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token required' });

    const normalizedEmail = email.toLowerCase();
    const hashed          = hashToken(token);
    const now             = new Date();

    const user = await User.findOne({ email: normalizedEmail }).select('+resetToken +resetTokenExpiry');
    if (user && user.resetToken === hashed && user.resetTokenExpiry && user.resetTokenExpiry > now) {
      return res.json({ valid: true });
    }

    const staff = await Staff.findOne({ email: normalizedEmail }).select('+loginOtp +loginOtpExpiry');
    if (!staff || staff.loginOtp !== hashed || !staff.loginOtpExpiry || staff.loginOtpExpiry < now) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    res.json({ valid: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/resend-verification
// ─────────────────────────────────────────────────────────────────
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If registered, a new code has been sent.' });
    if (user.isVerified) return res.status(400).json({ error: 'Already verified' });

    const rawToken = randomToken();
    user.verifyToken       = hashToken(rawToken);
    user.verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    try { await sendVerificationEmail(user.email, user.firstName || user.businessName, rawToken); }
    catch (e) { console.error('Email send failed:', e); }

    res.json({ message: 'If registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/resend-reset
// ─────────────────────────────────────────────────────────────────
router.post('/resend-reset', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();
    const rawToken = randomToken();

    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.resetToken       = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      try { await sendResetEmail(user.email, user.firstName || user.businessName, rawToken); }
      catch (e) { console.error('Reset email send failed:', e); }
      return res.json({ message: 'If registered, a new code has been sent.' });
    }

    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      staff.loginOtp       = hashToken(rawToken);
      staff.loginOtpExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await staff.save();
      try { await sendVerificationEmail(staff.email, staff.firstName, rawToken); }
      catch (e) { console.error('Staff reset OTP resend failed:', e); }
    }

    res.json({ message: 'If registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/send-change-password-otp
// ─────────────────────────────────────────────────────────────────
router.post('/send-change-password-otp', requireAuth, async (req, res, next) => {
  try {
    const rawToken = randomToken();
    const hashed   = hashToken(rawToken);
    const expiry   = new Date(Date.now() + 10 * 60 * 1000);

    if (req.isStaff) {
      const staff = await Staff.findById(req.staff._id);
      if (!staff) return res.status(404).json({ error: 'Staff account not found.' });
      staff.loginOtp       = hashed;
      staff.loginOtpExpiry = expiry;
      await staff.save();
      try { await sendVerificationEmail(staff.email, staff.firstName, rawToken); }
      catch (e) { console.error('Staff change-password OTP send failed:', e); }
      return res.json({ message: 'A verification code has been sent to your email.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.resetToken       = hashed;
    user.resetTokenExpiry = expiry;
    await user.save();
    try { await sendVerificationEmail(user.email, user.firstName || user.businessName, rawToken); }
    catch (e) { console.error('User change-password OTP send failed:', e); }

    res.json({ message: 'A verification code has been sent to your email.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// PIN lockout helpers
// ─────────────────────────────────────────────────────────────────
// Lock durations by attempt count: 3→1min, 4→3min, 5→1hr, 6→1day
const PIN_LOCK_DURATIONS      = { 3: 60_000, 4: 180_000, 5: 3_600_000, 6: 86_400_000 };
const PIN_FIRST_LOCK_AT       = 3;
const PIN_PERMANENT_THRESHOLD = 7;
// If 48 hrs pass with no wrong attempt, the escalation counter resets.
// Permanent locks are never auto-cleared — only an admin can lift those.
const PIN_ATTEMPT_RESET_MS    = 48 * 60 * 60 * 1000;

function getPinLockDuration(attempts) {
  return PIN_LOCK_DURATIONS[attempts] ?? null;
}

async function evaluatePinLockState(doc, now, contactNote) {
  // Permanent lock — never touched by the auto-reset
  if (doc.pinPermanentlyLocked) {
    return { status: 423, body: { error: `Your account has been locked. Please contact your ${contactNote}.`, permanentlyLocked: true } };
  }

  // Auto-restore: if 48 hrs have passed since the last wrong attempt, reset escalation
  if (doc.lastPinFailAt && (now.getTime() - doc.lastPinFailAt.getTime()) >= PIN_ATTEMPT_RESET_MS) {
    doc.pinAttempts    = 0;
    doc.pinLockedUntil = null;
    doc.lastPinFailAt  = null;
    await doc.save();
  }

  if (doc.pinLockedUntil && doc.pinLockedUntil > now) {
    return { status: 423, body: { error: 'Too many incorrect PIN attempts. Please try again later.', lockedUntil: doc.pinLockedUntil.toISOString() } };
  }
  if (doc.pinLockedUntil && doc.pinLockedUntil <= now) {
    // Lock expired — clear the timestamp but preserve pinAttempts so escalation continues
    doc.pinLockedUntil = null;
    await doc.save();
  }
  return null;
}

async function registerPinFailure(doc, now, contactNote) {
  doc.pinAttempts   = (doc.pinAttempts || 0) + 1;
  doc.lastPinFailAt = now;
  const attempts    = doc.pinAttempts;

  if (attempts >= PIN_PERMANENT_THRESHOLD) {
    doc.pinPermanentlyLocked = true;
    await doc.save();
    return { status: 423, body: { error: `Your account has been locked. Please contact your ${contactNote}.`, permanentlyLocked: true } };
  }
  const lockDuration = getPinLockDuration(attempts);
  if (lockDuration !== null) {
    doc.pinLockedUntil = new Date(now.getTime() + lockDuration);
    await doc.save();
    return { status: 423, body: { error: 'Incorrect PIN. Account locked. Please try again later.', lockedUntil: doc.pinLockedUntil.toISOString() } };
  }
  await doc.save();
  const attemptsLeft = PIN_FIRST_LOCK_AT - attempts;
  return { status: 403, body: { error: `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.` } };
}

function resetPinLockout(doc) {
  doc.pinAttempts    = 0;
  doc.pinLockedUntil = null;
  doc.lastPinFailAt  = null;
}

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-pin
// ─────────────────────────────────────────────────────────────────
router.post('/verify-pin', requireAuth, async (req, res, next) => {
  try {
    const { email, pin, propertyId } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    if (!pin)   return res.status(400).json({ error: 'PIN is required.' });

    const normalizedEmail = email.trim().toLowerCase();
    const now             = new Date();

    // ── 1. Try Staff ───────────────────────────────────────────────
    const staff = await Staff.findOne({ email: normalizedEmail }).select('+pin +lastPinFailAt');
    if (staff) {
      if (staff.isArchive) return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });
      if (!staff.isActive) return res.status(403).json({ error: 'Your account has been deactivated.' });

      const staffBlock = await evaluatePinLockState(staff, now, 'manager');
      if (staffBlock) return res.status(staffBlock.status).json(staffBlock.body);

      if (!propertyId) return res.status(400).json({ error: 'Property selection is required.' });

      const pinMatch = await bcrypt.compare(String(pin), staff.pin || '');
      if (!pinMatch) {
        const failResult = await registerPinFailure(staff, now, 'manager');
        return res.status(failResult.status).json(failResult.body);
      }

      const clientUser = await User.findById(staff.clientId).select('properties');
      let hasAccess = false;
      if (clientUser?.properties) {
        const selectedProp = clientUser.properties.find(p => String(p._id) === String(propertyId));
        hasAccess = staffCanAccessEmbeddedProperty(staff, selectedProp);
      }
      if (!hasAccess) return res.status(403).json({ error: 'You do not have access to this property' });

      resetPinLockout(staff);
      await staff.save();

      const { encAccessToken, rawRefresh, accessJti: pinStaffJti } = await issueTokenPair(
        signStaffAccessToken, signStaffRefreshToken, staff, req
      );

      setRefreshCookie(res, rawRefresh, req);
      const pinStaffSk = createSessionKey(pinStaffJti, accessTokenExpiryMs());

      return res.json({
        ok:          true,
        accessToken: encAccessToken,
        user:        sanitizeStaff(staff),
        ...(pinStaffSk ? { sk: pinStaffSk } : {}),
      });
    }

    // ── 2. Try User ────────────────────────────────────────────────
    const ownUser = await User.findOne({ email: normalizedEmail }).select('+pin +lastPinFailAt');
    if (!ownUser) return res.status(404).json({ error: 'Account not found.' });
    if (ownUser.isArchive) return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.', accountDisabled: true });

    const userBlock = await evaluatePinLockState(ownUser, now, 'administrator');
    if (userBlock) return res.status(userBlock.status).json(userBlock.body);

    if (!ownUser.pin) return res.status(403).json({ error: 'No PIN configured on this account.' });

    const pinMatch = await bcrypt.compare(String(pin), ownUser.pin);
    if (!pinMatch) {
      const failResult = await registerPinFailure(ownUser, now, 'administrator');
      return res.status(failResult.status).json(failResult.body);
    }

    resetPinLockout(ownUser);
    await ownUser.save();

    const { encAccessToken, rawRefresh, accessJti: pinUserJti } = await issueTokenPair(
      signAccessToken, signRefreshToken, ownUser, req
    );

    setRefreshCookie(res, rawRefresh, req);
    const pinUserSk = createSessionKey(pinUserJti, accessTokenExpiryMs());

    return res.json({ ok: true, accessToken: encAccessToken, user: sanitizeUser(ownUser), ...(pinUserSk ? { sk: pinUserSk } : {}) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/pin-status
// ─────────────────────────────────────────────────────────────────
router.get('/pin-status', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select('+pin');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ email: user.email, role: user.role, hasPin: !!user.pin, pinLength: user.pin ? user.pin.length : 0 });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/totp/setup  — generate secret + QR code
// ─────────────────────────────────────────────────────────────────
router.post('/totp/setup', requireAuth, async (req, res, next) => {
  try {
    const speakeasy = await import('speakeasy');
    const QRCode    = await import('qrcode');

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.default.generateSecret({
      name:   `HostOps (${user.email})`,
      length: 20,
    });

    // Store secret temporarily — only saved permanently after verify
    user.totpSecret  = secret.base32;
    user.totpEnabled = false;
    await user.save();

    const qrCodeUrl = await QRCode.default.toDataURL(secret.otpauth_url);

    res.json({ secret: secret.base32, qrCode: qrCodeUrl });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/totp/verify-setup  — confirm TOTP is working, enable it
// ─────────────────────────────────────────────────────────────────
router.post('/totp/verify-setup', requireAuth, async (req, res, next) => {
  try {
    const speakeasy = await import('speakeasy');
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const user = await User.findById(req.user._id).select('+totpSecret');
    if (!user || !user.totpSecret) return res.status(400).json({ error: 'No TOTP setup in progress' });

    const verified = speakeasy.default.totp.verify({
      secret:   user.totpSecret,
      encoding: 'base32',
      token:    token.replace(/\s/g, ''),
      window:   1,
    });

    if (!verified) return res.status(401).json({ error: 'Invalid code. Please try again.' });

    user.totpEnabled = true;
    user.totpDevices = user.totpDevices || [];
    const deviceName = req.body.deviceName || 'Authenticator App';
    user.totpDevices.push({ name: deviceName, addedAt: new Date() });
    await user.save();

    ActivityLog.create({
      userId:      user._id,
      performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
      businessName: user.businessName || '',
      action:      'totp_enabled',
      meta:        { deviceName },
      ipAddress:   req.ip || '',
      userAgent:   req.get('user-agent') || '',
    }).catch(() => {});

    res.json({ ok: true, message: 'Authenticator app enabled successfully.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/totp/disable  — turn off TOTP
// ─────────────────────────────────────────────────────────────────
router.post('/totp/disable', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.totpSecret  = null;
    user.totpEnabled = false;
    user.totpDevices = [];
    user.backupCodes = [];
    await user.save();

    ActivityLog.create({
      userId:      user._id,
      performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
      businessName: user.businessName || '',
      action:      'totp_disabled',
      meta:        {},
      ipAddress:   req.ip || '',
      userAgent:   req.get('user-agent') || '',
    }).catch(() => {});

    res.json({ ok: true, message: 'Authenticator app disabled.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/backup-codes/generate  — generate 10 backup codes
// ─────────────────────────────────────────────────────────────────
router.post('/backup-codes/generate', requireAuth, async (req, res, next) => {
  try {
    const crypto = await import('crypto');
    const user = await User.findById(req.user._id).select('+backupCodes');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.totpEnabled) return res.status(400).json({ error: '2FA must be enabled first' });

    const codes = [];
    const hashed = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = code.slice(0, 4) + '-' + code.slice(4);
      codes.push(formatted);
      hashed.push({ hash: await bcrypt.hash(code, 10), used: false });
    }

    user.backupCodes = hashed;
    await user.save();

    ActivityLog.create({
      userId: user._id,
      performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
      businessName: user.businessName || '',
      action: 'backup_codes_generated',
      ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '',
      userAgent: req.get('user-agent') || '',
    }).catch(() => {});

    res.json({ codes });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/backup-codes/count  — how many unused codes remain
// ─────────────────────────────────────────────────────────────────
router.get('/backup-codes/count', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+backupCodes');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const remaining = (user.backupCodes || []).filter(c => !c.used).length;
    const total = (user.backupCodes || []).length;
    res.json({ remaining, total });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/totp/verify  — verify TOTP code during login
// ─────────────────────────────────────────────────────────────────
router.post('/totp/verify', async (req, res, next) => {
  try {
    const speakeasy = await import('speakeasy');
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+totpSecret +backupCodes');
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: 'TOTP not enabled for this account' });
    }

    const cleanToken = token.replace(/\s/g, '');
    let verified = speakeasy.default.totp.verify({
      secret:   user.totpSecret,
      encoding: 'base32',
      token:    cleanToken,
      window:   1,
    });

    // If TOTP failed, try backup codes
    let usedBackupCode = false;
    if (!verified && user.backupCodes?.length > 0) {
      for (const bc of user.backupCodes) {
        if (bc.used) continue;
        const match = await bcrypt.compare(cleanToken.toUpperCase(), bc.hash);
        if (match) {
          bc.used = true;
          verified = true;
          usedBackupCode = true;
          break;
        }
      }
    }

    if (!verified) return res.status(401).json({ error: 'Invalid code. Please try again.' });

    const { encAccessToken, rawRefresh, accessJti: totpJti } = await issueTokenPair(
      signAccessToken, signRefreshToken, user, req
    );

    user.lastLoginAt = new Date();
    if (usedBackupCode) user.markModified('backupCodes');
    await user.save();

    setRefreshCookie(res, rawRefresh, req);
    const totpSk = createSessionKey(totpJti, accessTokenExpiryMs());

    const isAdmin = (user.tag === 'Main Admin' && user.role === 'admin') || user.email === process.env.ADMIN_ROLE;
    const remaining = usedBackupCode ? user.backupCodes.filter(c => !c.used).length : undefined;
    res.json({ accessToken: encAccessToken, user: sanitizeUser(user), isAdmin, ...(totpSk ? { sk: totpSk } : {}), ...(usedBackupCode ? { usedBackupCode: true, backupCodesRemaining: remaining } : {}) });
  } catch (err) { next(err); }
});

router.get('/totp/devices', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('totpDevices');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ devices: user.totpDevices || [] });
  } catch (err) { next(err); }
});

router.delete('/totp/devices/:deviceId', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const removed = (user.totpDevices || []).find(d => String(d._id) === req.params.deviceId);
    user.totpDevices = (user.totpDevices || []).filter(d => String(d._id) !== req.params.deviceId);
    await user.save();

    ActivityLog.create({
      userId:      user._id,
      performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' },
      businessName: user.businessName || '',
      action:      'totp_device_removed',
      meta:        { deviceName: removed?.name || 'Unknown device' },
      ipAddress:   req.ip || '',
      userAgent:   req.get('user-agent') || '',
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/profile-image  — upload/update profile image
// ─────────────────────────────────────────────────────────────────
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import os from 'os';

const profileUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

router.post('/profile-image', requireAuth, profileUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.profileImage) {
      const parts = user.profileImage.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder = parts[parts.length - 2];
      try { await cloudinary.uploader.destroy(`${folder}/${filename}`); } catch {}
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'hostops/profile-images',
      transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
    });

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    user.profileImage = result.secure_url;
    await user.save();

    res.json({ profileImage: result.secure_url });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
});

router.delete('/profile-image', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.profileImage) {
      const parts = user.profileImage.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder = parts[parts.length - 2];
      try { await cloudinary.uploader.destroy(`${folder}/${filename}`); } catch {}
    }

    user.profileImage = '';
    await user.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;