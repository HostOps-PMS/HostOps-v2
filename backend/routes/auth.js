// src/routes/auth.js
import express from 'express';
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

const router = express.Router();

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

// ── Helper: set the encrypted rt cookie ─────────────────────────
// Single place that controls cookie options so they stay consistent.
function setRefreshCookie(res, rawRefreshToken) {
  res.cookie('rt', encryptToken(rawRefreshToken), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge:   7 * 24 * 60 * 60 * 1000,
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

    const user = await User.create({
      email:             data.email.toLowerCase(),
      password:          data.password,
      firstName:         data.firstName,
      lastName:          data.lastName || '',
      businessName:      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || data.firstName,
      propertyTagPrefix: data.propertyTagPrefix || '',
      smoobuApiKey:      data.smoobuApiKey || null,
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
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { email, password, deviceId } = data;

    // ── 1. Try Staff login first ──────────────────────────────────
    const staff = await Staff.findOne({ email: email.toLowerCase() });
    if (staff) {
      if (!staff.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
      }

      const encAccessToken = encryptToken(signAccessToken(staff));
      const refreshToken   = signRefreshToken(staff);

      await RefreshToken.create({
        userId:    staff._id,
        token:     hashToken(refreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      staff.lastLoginAt = new Date();
      await staff.save();

      setRefreshCookie(res, refreshToken);

      return res.json({
        accessToken: encAccessToken,
        staff:       { ...staff.toJSON(), role: 'staff', isStaff: true },
        mustChangePassword: staff.mustChangePassword,
        mustChangePin:      staff.mustChangePin,
        isStaff:            true,
      });
    }

    // ── 2. Try User login ─────────────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    const userPasswordMatch = user && (await user.comparePassword(password));

    if (!userPasswordMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const isAdminCreated = user.mustChangePassword === true;
    if (!user.isVerified && !isAdminCreated) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const isAdmin = user.tag === 'Main Admin' || user.role === 'admin' || user.email === process.env.ADMIN_ROLE;
    let isTrusted = false;

    if (!isAdmin) {
      if (deviceId) {
        const trusted = await TrustedDevice.findOne({ userId: user._id, deviceId, expiresAt: { $gt: new Date() } });
        if (trusted) isTrusted = true;
      }

      if (!isTrusted) {
        const rawOtp = randomToken();
        user.loginOtp       = hashToken(rawOtp);
        user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        try { await sendVerificationEmail(user.email, user.firstName || user.businessName, rawOtp); }
        catch (e) { console.error('Login OTP email send failed:', e); }

        return res.json({ requiresOtp: true });
      }
    }

    // ── Check for existing valid rt cookie (reuse if still good) ──
    let refreshTokenToUse = null;

    if (!isAdmin && isTrusted) {
      const existingRaw = getRefreshCookie(req); // decrypt cookie first
      if (existingRaw) {
        try {
          const decoded = verifyRefreshToken(existingRaw);
          if (decoded.sub === user._id.toString()) {
            const stored = await RefreshToken.findOne({ token: hashToken(existingRaw) });
            if (stored && stored.isActive()) refreshTokenToUse = existingRaw;
          }
        } catch { /* ignore — issue a fresh one below */ }
      }
    }

    if (!refreshTokenToUse) {
      if (deviceId) {
        await RefreshToken.updateMany(
          { userId: user._id, deviceId, revokedAt: null },
          { revokedAt: new Date() }
        );
      }
      refreshTokenToUse = signRefreshToken(user);
      await RefreshToken.create({
        userId:    user._id,
        token:     hashToken(refreshTokenToUse),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceId:  deviceId || undefined,
      });
    }

    const encAccessToken = encryptToken(signAccessToken(user));

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

    setRefreshCookie(res, refreshTokenToUse);
    res.json({ accessToken: encAccessToken, user: user.toJSON(), isAdmin });
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
    if (!staff.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
    }

    const encAccessToken = encryptToken(signStaffAccessToken(staff));
    const refreshToken   = signStaffRefreshToken(staff);

    await RefreshToken.create({
      userId:    staff._id,
      token:     hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    staff.lastLoginAt = new Date();
    await staff.save();

    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken: encAccessToken,
      staff:       { ...staff.toJSON(), role: 'staff', isStaff: true },
      mustChangePassword: staff.mustChangePassword,
      mustChangePin:      staff.mustChangePin,
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
      user.loginOtp       = undefined;
      user.loginOtpExpiry = undefined;

      if (rememberMe) {
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await TrustedDevice.findOneAndUpdate(
          { userId: user._id, deviceId },
          { expiresAt },
          { upsert: true, new: true }
        );
      }

      const encAccessToken = encryptToken(signAccessToken(user));
      const refreshToken   = signRefreshToken(user);

      if (deviceId) {
        await RefreshToken.updateMany(
          { userId: user._id, deviceId, revokedAt: null },
          { revokedAt: new Date() }
        );
      }

      await RefreshToken.create({
        userId:    user._id,
        token:     hashToken(refreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceId:  deviceId || undefined,
      });

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

      setRefreshCookie(res, refreshToken);

      const isAdmin = user.tag === 'Main Admin' || user.role === 'admin' || user.email === process.env.ADMIN_ROLE;
      return res.json({ accessToken: encAccessToken, user: user.toJSON(), isAdmin });
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
    if (!stored || !stored.isActive()) return res.status(401).json({ error: 'Refresh token revoked' });

    // ── Staff refresh ─────────────────────────────────────────────
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff || !staff.isActive) return res.status(401).json({ error: 'Staff account not found or inactive' });

      const newRefreshToken = signStaffRefreshToken(staff);
      stored.revokedAt  = new Date();
      stored.replacedBy = hashToken(newRefreshToken);
      await stored.save();

      await RefreshToken.create({
        userId:    staff._id,
        token:     hashToken(newRefreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      setRefreshCookie(res, newRefreshToken);

      return res.json({
        accessToken: encryptToken(signStaffAccessToken(staff)),
        user: { ...staff.toJSON(), role: 'staff', isStaff: true, clientId: staff.clientId?.toString() },
      });
    }

    // ── Regular user refresh ──────────────────────────────────────
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newRefreshToken = signRefreshToken(user);
    stored.revokedAt  = new Date();
    stored.replacedBy = hashToken(newRefreshToken);
    await stored.save();

    await RefreshToken.create({
      userId:    user._id,
      token:     hashToken(newRefreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setRefreshCookie(res, newRefreshToken);
    res.json({ accessToken: encryptToken(signAccessToken(user)) });
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

    // Revoke access token jti
    const header     = req.headers.authorization || '';
    const accessBlob = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (accessBlob) {
      const jti = extractJti(accessBlob);
      if (jti) await revokeAccessJti(jti, req.user?._id || 'unknown', 'logout');
    }

    res.clearCookie('rt', { path: '/auth' });
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

    const jti = extractJti(token);
    if (jti) await revokeAccessJti(jti, 'beacon', 'tab_close');

    // Also revoke the refresh token cookie if present
    const rawRt = getRefreshCookie(req);
    if (rawRt) {
      await RefreshToken.findOneAndUpdate(
        { token: hashToken(rawRt) },
        { revokedAt: new Date() }
      );
    }

    res.clearCookie('rt', { path: '/auth' });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  if (req.isStaff && req.staff) {
    return res.json({
      user: { ...req.staff.toJSON(), role: 'staff', isStaff: true, clientId: req.staff.clientId?.toString() },
    });
  }
  res.json({ user: req.user.toJSON() });
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
  const list = (req.user.properties || []);
  res.json({
    businessName: req.user.businessName || '',
    properties:   list.map((p) => ({
      _id:             p._id,
      propertyName:    p.propertyName,
      propertyPicture: p.propertyPicture || '',
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

      await RefreshToken.updateMany({ userId: staff._id, revokedAt: null }, { revokedAt: new Date() });

      const header     = req.headers.authorization || '';
      const accessBlob = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (accessBlob) {
        const jti = extractJti(accessBlob);
        if (jti) await revokeAccessJti(jti, staff._id, 'password_change');
      }

      return res.json({ message: 'Password changed successfully.', staff: staff.toJSON() });
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

    res.json({ message: 'Password changed successfully.', user: user.toJSON() });
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

      return res.json({ message: 'PIN changed successfully.', staff: staff.toJSON() });
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

    res.json({ message: 'PIN changed successfully.', user: user.toJSON() });
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

    res.json({ message: 'Profile updated successfully.', user: user.toJSON() });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    next(err);
  }
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
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      staff.loginOtp       = hashToken(rawToken);
      staff.loginOtpExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await staff.save();
      try { await sendVerificationEmail(staff.email, staff.firstName, rawToken); }
      catch (e) { console.error('Staff reset OTP email send failed:', e); }
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
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
    try { await sendResetEmail(user.email, user.firstName || user.businessName, rawToken); }
    catch (e) { console.error('User change-password OTP send failed:', e); }

    res.json({ message: 'A verification code has been sent to your email.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// PIN lockout helpers
// ─────────────────────────────────────────────────────────────────
const PIN_LOCK_DURATIONS      = { 3: 60000, 4: 180000, 5: 900000, 6: 3600000 };
const PIN_FIRST_LOCK_AT       = 3;
const PIN_PERMANENT_THRESHOLD = 7;
const PIN_ATTEMPT_RESET_MS    = 48 * 60 * 60 * 1000;

function getPinLockDuration(attempts) {
  return PIN_LOCK_DURATIONS[attempts] ?? null;
}

async function evaluatePinLockState(doc, now, contactNote) {
  if (doc.lastPinFailAt && (now.getTime() - doc.lastPinFailAt.getTime()) >= PIN_ATTEMPT_RESET_MS) {
    doc.pinAttempts    = 0;
    doc.pinLockedUntil = null;
    doc.lastPinFailAt  = null;
    await doc.save();
  }
  if (doc.pinPermanentlyLocked) {
    return { status: 423, body: { error: `Your account has been locked. Please contact your ${contactNote}.`, permanentlyLocked: true } };
  }
  if (doc.pinLockedUntil && doc.pinLockedUntil > now) {
    return { status: 423, body: { error: 'Too many incorrect PIN attempts. Please try again later.', lockedUntil: doc.pinLockedUntil.toISOString() } };
  }
  if (doc.pinLockedUntil && doc.pinLockedUntil <= now) {
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

      const encAccessToken  = encryptToken(signStaffAccessToken(staff));
      const staffRefreshTok = signStaffRefreshToken(staff);

      await RefreshToken.create({
        userId:    staff._id,
        token:     hashToken(staffRefreshTok),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      setRefreshCookie(res, staffRefreshTok);

      return res.json({
        ok:          true,
        accessToken: encAccessToken,
        user:        { ...staff.toJSON(), role: 'staff', isStaff: true, clientId: staff.clientId.toString() },
      });
    }

    // ── 2. Try User ────────────────────────────────────────────────
    const ownUser = await User.findOne({ email: normalizedEmail }).select('+pin +lastPinFailAt');
    if (!ownUser) return res.status(404).json({ error: 'Account not found.' });

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

    const encAccessToken = encryptToken(signAccessToken(ownUser));
    const userRefreshTok = signRefreshToken(ownUser);

    await RefreshToken.create({
      userId:    ownUser._id,
      token:     hashToken(userRefreshTok),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setRefreshCookie(res, userRefreshTok);

    return res.json({ ok: true, accessToken: encAccessToken, user: ownUser.toJSON() });
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

export default router;