// src/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/user.js';
import Staff from '../models/staff.js';
import RefreshToken from '../models/refreshToken.js';
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
} from "../utils/tokens.js";
import { sendVerificationEmail, sendResetEmail } from '../services/email.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  email:             z.string().email().max(254),
  password:          z.string().min(8).max(128),
  firstName:         z.string().min(1).max(50),
  lastName:          z.string().max(50).optional().default(''),
  propertyTagPrefix: z.string().optional().default(''),
  // Each user connects their own Smoobu account via their API key.
  // The login email must match the email on the Smoobu account.
  // This key is stored with select:false and is loaded only on
  // authenticated requests (see middleware/auth.js).
  smoobuApiKey:      z.string().max(512).optional().default(''),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // smoobuApiKey and propertyTagPrefix are both optional at registration.
    // Users with neither will see an empty dashboard (smoobuNotConnected)
    // until they connect their Smoobu account via PATCH /auth/smoobu-key.
    // belongsToUser() in smoobu.js correctly returns false for accounts
    // with no key and no prefix - no data leak risk.
    const rawToken = randomToken();
    const hashed = hashToken(rawToken);

    const user = await User.create({
      email:             data.email.toLowerCase(),
      password:          data.password,
      firstName:         data.firstName,
      lastName:          data.lastName || '',
      businessName:      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || data.firstName,
      propertyTagPrefix: data.propertyTagPrefix || '',
      // Store the user's personal Smoobu API key so the smoobu service
      // can use it to fetch only their properties and bookings.
      smoobuApiKey:      data.smoobuApiKey || null,
      isVerified:        false,
      verifyToken:       hashed,
      verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const contactWebhookUrl = process.env.GHL_CONTACT_WEBHOOK_URL;
    if (contactWebhookUrl) {
      try {
        await fetch(contactWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
          }),
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

    res.status(201).json({
      message: 'Account created. Please check your email to verify.',
      userId: user._id,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// POST /auth/verify
router.post('/verify', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: 'Email and token required' });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({
      email: email.toLowerCase(),
      verifyToken: hashed,
      verifyTokenExpiry: { $gt: new Date() },
    }).select('+verifyToken +verifyTokenExpiry');

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.isVerified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) { next(err); }
});

// POST /auth/login
// Handles both regular users AND staff accounts so the frontend
// only needs one login endpoint.
//
// ── Login priority order ──────────────────────────────────────────
// Staff is checked FIRST. This is intentional: a staff member's email
// may coincidentally exist in the User collection (e.g. if the client
// created a User account with the same email). If we checked User first
// and the password matched, the staff member would receive a User token
// instead of a Staff token — req.isStaff would be false and PIN
// verification would fail. Checking Staff first guarantees the correct
// token type is issued regardless of User collection overlap.
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { email, password, deviceId } = data;

    // ── 1. Try Staff login first ───────────────────────────────────
    // Staff accounts have no password — they authenticate via PIN only.
    // Email match + isActive check is sufficient to issue a staff token.
    // PIN verification happens later in /auth/verify-pin.
    const staff = await Staff.findOne({ email: email.toLowerCase() });
    if (staff) {
      if (!staff.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
      }

      const accessToken  = signStaffAccessToken(staff);
      const refreshToken = signStaffRefreshToken(staff);

      await RefreshToken.create({
        userId:    staff._id,
        token:     hashToken(refreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      staff.lastLoginAt = new Date();
      await staff.save();

      res.cookie('rt', refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.json({
        accessToken,
        // Inject role:'staff' and isStaff:true into the staff object so the
        // frontend can detect staff sessions from the stored hp_user object.
        // The Staff schema has no 'role' field — we add it here explicitly.
        staff:              { ...staff.toJSON(), role: 'staff', isStaff: true },
        mustChangePassword: staff.mustChangePassword,
        isStaff:            true,
      });
    }

    // ── 2. Try User login ──────────────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    const userPasswordMatch = user && (await user.comparePassword(password));

    if (!userPasswordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Block only self-registered accounts that have not yet clicked their
    // verification email. Admin-created accounts (mustChangePassword: true)
    // are allowed through — the frontend shows the first-login password-change
    // modal on the dashboard instead.
    const isAdminCreated = user.mustChangePassword === true;
    if (!user.isVerified && !isAdminCreated) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const isAdmin = user.tag === "Main Admin" || user.role === "admin" || user.email === process.env.ADMIN_ROLE;
    let isTrusted = false;
    if (!isAdmin) { 
      if (deviceId) {
        const trusted = await TrustedDevice.findOne({ userId: user._id, deviceId, expiresAt: { $gt: new Date() } });
        if (trusted) isTrusted = true;
      }

      if (!isTrusted) {
        const rawOtp = randomToken();
        user.loginOtp = hashToken(rawOtp);
        user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();

        try {
          await sendVerificationEmail(user.email, user.firstName || user.businessName, rawOtp);
        } catch (e) {
          console.error('Login OTP email send failed:', e);
        }

        return res.json({ requiresOtp: true });
      }
    }

    let refreshTokenToUse = null;

    if (!isAdmin && isTrusted && req.cookies?.rt) {
      try {
        const decoded = verifyRefreshToken(req.cookies.rt);
        if (decoded.sub === user._id.toString()) {
          const stored = await RefreshToken.findOne({ token: hashToken(req.cookies.rt) });
          if (stored && stored.isActive()) {
            refreshTokenToUse = req.cookies.rt;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!refreshTokenToUse) {
      // Revoke previous active refresh tokens for the same device
      if (deviceId) {
        await RefreshToken.updateMany(
          { userId: user._id, deviceId, revokedAt: null },
          { revokedAt: new Date() }
        );
      }

      refreshTokenToUse = signRefreshToken(user);

      await RefreshToken.create({
        userId: user._id,
        token: hashToken(refreshTokenToUse),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceId: deviceId || undefined,
      });
    }

    const accessToken = signAccessToken(user);

    user.lastLoginAt = new Date();
    user.activityLog = user.activityLog || [];
    user.activityLog.push({ action: 'login', ipAddress: req.ip || '', userAgent: req.get('user-agent') || '', timestamp: new Date(), performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' } });
    if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
    await user.save();

    res.cookie('rt', refreshTokenToUse, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    res.json({
      accessToken,
      user: user.toJSON(),
      isAdmin,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/staff-login
// Staff members log in with email + password.
// No OTP flow — staff accounts are admin-created and pre-trusted.
// Returns a staff-scoped access token (role: 'staff', clientId claim)
// so the middleware can load both the Staff record and the client's
// Smoobu API key on every subsequent request.
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

    const accessToken  = signStaffAccessToken(staff);
    const refreshToken = signStaffRefreshToken(staff);

    await RefreshToken.create({
      userId:    staff._id,   // reuse RefreshToken model — userId = staffId here
      token:     hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    staff.lastLoginAt = new Date();
    await staff.save();

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/auth',
    });

    res.json({
      accessToken,
      // Inject role:'staff' and isStaff:true so the frontend can always
      // identify staff sessions from the stored hp_user object.
      staff: { ...staff.toJSON(), role: 'staff', isStaff: true },
      mustChangePassword: staff.mustChangePassword,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed' });
    }
    next(err);
  }
});

// POST /auth/verify-login-otp
// Verifies the 6-digit OTP for both regular Users and ClientAccounts.
// ClientAccounts go through the admin AuthModal OTP gate, so their OTP
// is stored on the ClientAccount document — not on User.
// Each account type gets its own correctly-scoped access/refresh tokens.
router.post('/verify-login-otp', async (req, res, next) => {
  try {
    const { email, otp, deviceId, rememberMe } = req.body;
    if (!email || !otp || !deviceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedEmail = email.toLowerCase();
    const hashedOtp       = hashToken(otp);
    const now             = new Date();

    // ── Try User first ─────────────────────────────────────────────
    const user = await User.findOne({
      email:          normalizedEmail,
      loginOtp:       hashedOtp,
      loginOtpExpiry: { $gt: now },
    }).select('+loginOtp +loginOtpExpiry');

    if (user) {
      user.loginOtp       = undefined;
      user.loginOtpExpiry = undefined;

      if (rememberMe) {
        // const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 days
        // const expiresIn = 60000; // 1 min.
        const expiresIn = 60 * 60 * 1000; // 1 hour
        const expiresAt = new Date(Date.now() + expiresIn);

        await TrustedDevice.findOneAndUpdate(
          { userId: user._id, deviceId },
          { expiresAt },
          { upsert: true, new: true },
        );
      }

      const accessToken  = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      // Revoke previous active refresh tokens for the same device
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
      user.activityLog.push({ action: 'login', ipAddress: req.ip || '', userAgent: req.get('user-agent') || '', timestamp: new Date(), performedBy: { userId: user._id, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '', role: user.role || 'client' } });
      if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
      await user.save();

      res.cookie('rt', refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      const isAdmin = user.tag === 'Main Admin' || user.role === 'admin' || user.email === process.env.ADMIN_ROLE;

      return res.json({
        accessToken,
        user: user.toJSON(),
        isAdmin,
      });
    }

    return res.status(401).json({ error: 'Invalid or expired OTP' });
  } catch (err) { next(err); }
});

// POST /auth/send-login-otp
// Called by the admin AuthModal on mount to trigger the initial OTP email.
// Checks both User and ClientAccount collections so admins, team leaders,
// and client accounts all receive the OTP correctly.
router.post('/send-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();

    const account = await User.findOne({ email: normalizedEmail });

    // Respond with success even if not found (avoid enumeration).
    if (!account) {
      return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    }

    const rawOtp = randomToken();
    account.loginOtp       = hashToken(rawOtp);
    account.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await account.save();

    try {
      await sendVerificationEmail(account.email, account.firstName, rawOtp);
    } catch (e) {
      console.error('Login OTP email send failed:', e);
    }

    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/resend-login-otp
// Re-generates and re-sends the login OTP for a given email.
// Checks both User and ClientAccount collections so all account types
// can resend their OTP from the admin AuthModal.
router.post('/resend-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();

    const account = await User.findOne({ email: normalizedEmail });

    if (!account) {
      return res.json({ message: 'If that email is registered, a new code has been sent.' });
    }

    const rawOtp = randomToken();
    account.loginOtp       = hashToken(rawOtp);
    account.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await account.save();

    try {
      await sendVerificationEmail(account.email, account.firstName, rawOtp);
    } catch (e) {
      console.error('Login OTP resend email send failed:', e);
    }

    res.json({ message: 'If that email is registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.rt;
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });

    let decoded;
    try {
      decoded = verifyRefreshToken(rawToken);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const stored = await RefreshToken.findOne({ token: hashToken(rawToken) });
    if (!stored || !stored.isActive()) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    // ── Staff refresh ──────────────────────────────────────────────
    // Staff refresh tokens carry role: 'staff' and staffId/clientId.
    // Re-sign using staff-specific signing function so the new access
    // token still carries the staff claims.
    if (decoded.role === 'staff') {
      const staff = await Staff.findById(decoded.staffId || decoded.sub);
      if (!staff || !staff.isActive) {
        return res.status(401).json({ error: 'Staff account not found or inactive' });
      }

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

      res.cookie('rt', newRefreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.json({ accessToken: signStaffAccessToken(staff) });
    }



    // ── Regular user refresh ───────────────────────────────────────
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newRefreshToken = signRefreshToken(user);
    stored.revokedAt = new Date();
    stored.replacedBy = hashToken(newRefreshToken);
    await stored.save();

    await RefreshToken.create({
      userId: user._id,
      token: hashToken(newRefreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.cookie('rt', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    res.json({ accessToken: signAccessToken(user) });
  } catch (err) { next(err); }
});

// POST /auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.rt;
    if (rawToken) {
      await RefreshToken.findOneAndUpdate(
        { token: hashToken(rawToken) },
        { revokedAt: new Date() }
      );
    }
    res.clearCookie('rt', { path: '/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// POST /auth/log-activity
router.post('/log-activity', requireAuth, async (req, res, next) => {
  try {
    const { action, meta = {} } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.activityLog = user.activityLog || [];
    user.activityLog.push({
      action,
      timestamp: new Date(),
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
      meta,
      performedBy: {
        userId: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
        role: req.user.role || 'client',
      },
    });
    if (user.activityLog.length > 100) user.activityLog = user.activityLog.slice(-100);
    await user.save();

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /auth/activity-log
router.get('/activity-log', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('activityLog');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const log = (user.activityLog || []).slice().reverse(); // newest first
    res.json({ activityLog: log });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/my-properties
// Returns the embedded properties of the currently authenticated user.
// Accessible by all authenticated user types (client, clientAccount, staff,
// admin, team_leader). smoobuApiKey is never returned — the User.toJSON()
// method strips it, and for clientAccount/staff the parent user's toJSON()
// is used. Used by PropertySelectForm to list user-defined properties
// (propertyName + _id) instead of Smoobu apartments.
// ─────────────────────────────────────────────────────────────────
router.get('/my-properties', requireAuth, (req, res) => {
  // req.user is always the parent client (carries the properties array)
  // regardless of whether the session is a direct client, clientAccount, or staff.
  //
  // Staff: filter down to only their assigned properties so PropertySelectForm
  // only shows what they have access to.
  //
  // IMPORTANT — two ID spaces exist and must NOT be confused:
  //   • p._id          — MongoDB ObjectId of the embedded property in user.properties[]
  //                      This is what PropertySelectForm sends back as propertyDbId,
  //                      and what dashboard.js uses to look up the smoobuApiKey.
  //   • staff.propertyIds (req.staffPropertyIds) — Smoobu numeric apartment IDs,
  //                      stored on the Staff document, used for Smoobu data filtering.
  //
  // Previously this filter compared req.staffPropertyIds (Smoobu IDs) against
  // p._id (MongoDB ObjectId) — they never matched, so staff always got an empty
  // property list and could never reach the PIN screen or the dashboard.
  //
  // Fix: each embedded property also carries its own Smoobu IDs inside
  // p.subProperties[].smoobuId. We cross-reference through subProperties to
  // find which embedded properties contain at least one of the staff's assigned
  // Smoobu IDs, then return only those.
  //
  // Fallback: if subProperties haven't been synced yet (empty array), fall back
  // to returning ALL of the client's properties so staff are never locked out
  // on a fresh setup. The dashboard's MODE C filter (applyStaffPropertyFilter)
  // will still enforce Smoobu-level access correctly.
  let list = (req.user.properties || []);

  if (req.isStaff && req.staffPropertyIds?.length) {
    const assignedSmoobuIds = new Set(req.staffPropertyIds.map(String));

    const filtered = list.filter((p) => {
      const subs = p.subProperties || [];
      // Match if any sub-property's Smoobu ID is in the staff's assigned set
      return subs.some((sub) => assignedSmoobuIds.has(String(sub.smoobuId)));
    });

    // Only use the filtered list if we actually found matches.
    // If subProperties haven't been synced yet, fall back to all properties
    // so staff aren't shown a blank screen on a fresh account.
    if (filtered.length > 0) {
      list = filtered;
    }
    // If filtered.length === 0 (no subProperties synced), keep full list —
    // MODE C in dashboard.js will still enforce data access correctly.
  }

  res.json({
    businessName: req.user.businessName || '',
    properties: list.map((p) => ({
      _id:           p._id,
      propertyName:  p.propertyName,
      propertyPicture: p.propertyPicture || '',
      businessName:  req.user.businessName || '',
    })),
  });
});

// POST /auth/change-password
// Used on first login when mustChangePassword is true.
// Verifies the current (temporary) password, sets the new one,
// and marks the account as verified — completing the onboarding flow.
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const changeSchema = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8).max(128),
    });

    const { currentPassword, newPassword } = changeSchema.parse(req.body);

    // ── Staff change-password ──────────────────────────────────────
    if (req.isStaff) {
      const staff = await Staff.findById(req.staff._id).select('+password');
      if (!staff) return res.status(404).json({ error: 'Staff not found' });

      const isMatch = await staff.comparePassword(currentPassword);
      if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from the current one' });
      }

      staff.password           = newPassword;
      staff.mustChangePassword = false;
      await staff.save();

      await RefreshToken.updateMany(
        { userId: staff._id, revokedAt: null },
        { revokedAt: new Date() }
      );

      return res.json({ message: 'Password changed successfully.', staff: staff.toJSON() });
    }



    // ── Regular user change-password ───────────────────────────────
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one' });
    }

    user.password = newPassword;

    if (user.mustChangePassword) {
      user.mustChangePassword = false;
      user.isVerified = true;
    }

    user.activityLog = user.activityLog || [];
    user.activityLog.push({ action: 'password_changed', ipAddress: req.ip || '', userAgent: req.get('user-agent') || '' });
    if (user.activityLog.length > 50) user.activityLog = user.activityLog.slice(-50);
    await user.save();

    // Revoke all existing refresh tokens so old sessions are invalidated.
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.json({ message: 'Password changed successfully.', user: user.toJSON() });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// PATCH /auth/profile
// Updates editable profile fields: firstName, lastName, propertyTagPrefix.
// Email is intentionally excluded — changing it would require re-verification.
router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const profileSchema = z.object({
      firstName:         z.string().min(1).max(50).trim(),
      lastName:          z.string().max(50).trim().optional().default(''),
      propertyTagPrefix: z.string().max(100).trim().optional().default(''),
    });

    const data = profileSchema.parse(req.body);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.firstName         = data.firstName;
    user.lastName          = data.lastName ?? '';
    user.businessName      = [data.firstName, data.lastName ?? ''].filter(Boolean).join(' ').trim() || data.firstName;
    user.propertyTagPrefix = data.propertyTagPrefix ?? '';
    await user.save();

    res.json({ message: 'Profile updated successfully.', user: user.toJSON() });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// PATCH /auth/smoobu-key
router.patch('/smoobu-key', requireAuth, async (req, res, next) => {
  try {
    const { smoobuApiKey } = req.body;
    if (!smoobuApiKey || typeof smoobuApiKey !== 'string' || !smoobuApiKey.trim()) {
      return res.status(400).json({ error: 'smoobuApiKey is required' });
    }

    const user = await User.findById(req.user._id).select('+smoobuApiKey');
    user.smoobuApiKey = smoobuApiKey.trim();
    user.smoobuConnectedAt = new Date();
    await user.save();

    res.json({ message: 'Smoobu API key updated successfully.' });
  } catch (err) { next(err); }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();
    const rawToken = randomToken();

    // ── Regular User ───────────────────────────────────────────────
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.resetToken = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendResetEmail(user.email, user.firstName || user.businessName, rawToken);
      } catch (e) {
        console.error('Reset email send failed:', e);
      }

      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    // ── Staff fallback — Staff has no resetToken fields, reuse loginOtp ──
    // Staff accounts are admin-managed and always have a valid email.
    // We store the OTP in loginOtp/loginOtpExpiry (already on the Staff schema)
    // and send via sendVerificationEmail (same GHL webhook staff use for login OTP).
    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      staff.loginOtp       = hashToken(rawToken);
      staff.loginOtpExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await staff.save();

      try {
        await sendVerificationEmail(staff.email, staff.firstName, rawToken);
      } catch (e) {
        console.error('Staff reset OTP email send failed:', e);
      }
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: hashToken(token),
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.json({ message: 'Password reset. Please log in with your new password.' });
  } catch (err) { next(err); }
});

// POST /auth/verify-reset-token
// Used to silently verify the 6-digit OTP before asking for new password.
// Checks User (resetToken) first, then Staff (loginOtp) as fallback.
router.post('/verify-reset-token', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token required' });

    const normalizedEmail = email.toLowerCase();
    const hashed          = hashToken(token);
    const now             = new Date();

    // ── Regular User ───────────────────────────────────────────────
    // resetToken is select:false — cannot filter by it in findOne() directly.
    // Fetch by email with +resetToken, then compare manually.
    const user = await User.findOne({ email: normalizedEmail })
      .select('+resetToken +resetTokenExpiry');

    console.log('[verify-reset-token] user found:', !!user);
    if (user) {
      console.log('[verify-reset-token] user.resetToken:', user.resetToken);
      console.log('[verify-reset-token] hashed submitted:', hashed);
      console.log('[verify-reset-token] expiry:', user.resetTokenExpiry, '> now:', user.resetTokenExpiry > now);
    }

    if (
      user &&
      user.resetToken === hashed &&
      user.resetTokenExpiry &&
      user.resetTokenExpiry > now
    ) {
      return res.json({ valid: true });
    }



    // ── Staff fallback ─────────────────────────────────────────────
    // loginOtp is select:false on the Staff schema, so we cannot filter
    // by it directly in findOne() — MongoDB excludes select:false fields
    // from query matching. Fetch by email first, then compare manually.
    const staff = await Staff.findOne({ email: normalizedEmail })
      .select('+loginOtp +loginOtpExpiry');

    if (
      !staff ||
      staff.loginOtp !== hashed ||
      !staff.loginOtpExpiry ||
      staff.loginOtpExpiry < now
    ) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    res.json({ valid: true });
  } catch (err) { next(err); }
});

// POST /auth/resend-verification
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If registered, a new code has been sent.' });
    if (user.isVerified) return res.status(400).json({ error: 'Already verified' });

    const rawToken = randomToken();
    user.verifyToken = hashToken(rawToken);
    user.verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.firstName || user.businessName, rawToken);
    } catch (e) {
      console.error('Email send failed:', e);
    }

    res.json({ message: 'If registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/resend-reset
router.post('/resend-reset', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalizedEmail = email.toLowerCase();
    const rawToken = randomToken();

    // ── Regular User ───────────────────────────────────────────────
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.resetToken = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendResetEmail(user.email, user.firstName || user.businessName, rawToken);
      } catch (e) {
        console.error('Reset email send failed:', e);
      }

      return res.json({ message: 'If registered, a new code has been sent.' });
    }

    // ── Staff fallback ─────────────────────────────────────────────
    const staff = await Staff.findOne({ email: normalizedEmail });
    if (staff) {
      staff.loginOtp       = hashToken(rawToken);
      staff.loginOtpExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await staff.save();

      try {
        await sendVerificationEmail(staff.email, staff.firstName, rawToken);
      } catch (e) {
        console.error('Staff reset OTP resend failed:', e);
      }
    }

    res.json({ message: 'If registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/send-change-password-otp
// Sends a dedicated OTP for the account-settings password change flow.
// Requires the user to be authenticated (Bearer token via requireAuth).
// Stores the OTP in:
//   - User          → resetToken + resetTokenExpiry
//   - Staff/ClientAccount → loginOtp  + loginOtpExpiry
// The OTP is then verified via POST /auth/verify-reset-token before
// the frontend calls POST /auth/change-password.
// ─────────────────────────────────────────────────────────────────
router.post('/send-change-password-otp', requireAuth, async (req, res, next) => {
  try {
    const rawToken = randomToken();
    const hashed   = hashToken(rawToken);
    const expiry   = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ── Staff ──────────────────────────────────────────────────────
    if (req.isStaff) {
      const staff = await Staff.findById(req.staff._id);
      if (!staff) return res.status(404).json({ error: 'Staff account not found.' });

      staff.loginOtp       = hashed;
      staff.loginOtpExpiry = expiry;
      await staff.save();

      try {
        await sendVerificationEmail(staff.email, staff.firstName, rawToken);
      } catch (e) {
        console.error('Staff change-password OTP send failed:', e);
      }

      return res.json({ message: 'A verification code has been sent to your email.' });
    }



    // ── Regular User ───────────────────────────────────────────────
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.resetToken       = hashed;
    user.resetTokenExpiry = expiry;
    await user.save();

    try {
      await sendResetEmail(user.email, user.firstName || user.businessName, rawToken);
    } catch (e) {
      console.error('User change-password OTP send failed:', e);
    }

    res.json({ message: 'A verification code has been sent to your email.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// POST /auth/verify-pin
//
// Verifies the 6-digit PIN for the currently authenticated user.
// Called by PinModal after property selection.
//
// The account is identified by the `email` field in the request body.
// This replaces the previous approach of relying solely on the JWT
// claims (req.isStaff / req.user._id) for account resolution.
//
// Lookup order:
//   1. Check Staff collection for the email → staff PIN path
//   2. Check User collection for the email  → client / team_leader / admin PIN path
//
// User types and their PIN logic:
//   - staff       → PIN must match AND the selected propertyId must be
//                   in staff.propertyIds. If the property is not assigned
//                   to this staff member, access is denied even if the PIN
//                   is correct.
//   - client      → PIN must match. Property access is unrestricted.
//   - team_leader → PIN must match. Property access is unrestricted.
//
// Lockout schedule (cumulative wrong attempts per account):
//   attempts 1–2  : no lock (warnings returned)
//   attempt  3    : locked for 1 minute
//   attempt  4    : locked for 3 minutes
//   attempt  5    : locked for 15 minutes
//   attempt  6    : locked for 1 hour
//   attempt  7+   : permanently locked — pinPermanentlyLocked = true,
//                   requires admin intervention to unlock
//
// Body:
//   { email: string, pin: string, propertyId: string, isStaff: boolean }
//
// Returns:
//   200 { ok: true }
//   400 { error: '...' }  — missing fields
//   403 { error: '...' }  — wrong PIN or property not assigned
//   423 { error: '...', lockedUntil: ISO string } — account temporarily locked
//   423 { error: '...', permanentlyLocked: true } — account permanently locked
// ─────────────────────────────────────────────────────────────────

// ─── PIN lockout configuration ────────────────────────────────────
// Escalation ladder (cumulative wrong attempts per account):
//   attempt 1–2 : no lock — warning only
//   attempt 3   : locked 1 minute
//   attempt 4   : locked 3 minutes
//   attempt 5   : locked 15 minutes
//   attempt 6   : locked 1 hour
//   attempt 7   : permanently locked (admin unlock required)
//
// pinAttempts is PERSISTED and keeps climbing across lock windows — it is
// NEVER reset just because a temporary lock expired. The ONLY automatic
// reset is the 48-hour rule below: if the last wrong attempt was 48h+ ago,
// the counter starts fresh on the next verify call.
const PIN_LOCK_DURATIONS = {
  3: 1  * 60 * 1000,
  4: 3  * 60 * 1000,
  5: 15 * 60 * 1000,
  6: 60 * 60 * 1000,
};

const PIN_FIRST_LOCK_AT       = 3;                    // first attempt that triggers a lock
const PIN_PERMANENT_THRESHOLD = 7;                    // attempt that triggers permanent lock
const PIN_ATTEMPT_RESET_MS    = 48 * 60 * 60 * 1000;  // 48h since last wrong attempt → reset

function getPinLockDuration(attempts) {
  return PIN_LOCK_DURATIONS[attempts] ?? null; // null = permanent (>= PIN_PERMANENT_THRESHOLD)
}

// ─────────────────────────────────────────────────────────────────
// evaluatePinLockState(doc, now, contactNote)
//
// Runs BEFORE verifying the PIN. Shared by the staff and user paths so
// both behave identically. It:
//   1. Applies the 48h auto-reset (only reset trigger for attempts).
//   2. Returns a blocking response if the account is permanently locked
//      or inside an active temporary lock window.
//   3. Clears an EXPIRED temporary lock flag WITHOUT touching pinAttempts,
//      so the escalation ladder continues where it left off.
//
// Returns a { status, body } descriptor when the request must be blocked,
// otherwise null (caller may proceed to verify the PIN).
// ─────────────────────────────────────────────────────────────────
async function evaluatePinLockState(doc, now, contactNote) {
  // 48h rule: if the last wrong attempt was 48h+ ago, wipe the slate clean.
  // This is the ONLY automatic reset of pinAttempts.
  if (doc.lastPinFailAt && (now.getTime() - doc.lastPinFailAt.getTime()) >= PIN_ATTEMPT_RESET_MS) {
    doc.pinAttempts    = 0;
    doc.pinLockedUntil = null;
    doc.lastPinFailAt  = null;
    // Note: pinPermanentlyLocked is intentionally NOT cleared here — a
    // permanent lock can only be lifted by an admin via /api/accounts/unlock.
    await doc.save();
  }

  if (doc.pinPermanentlyLocked) {
    return {
      status: 423,
      body: {
        error: `Your account has been locked due to too many incorrect PIN attempts. Please contact your ${contactNote}.`,
        permanentlyLocked: true,
      },
    };
  }

  if (doc.pinLockedUntil && doc.pinLockedUntil > now) {
    return {
      status: 423,
      body: {
        error: 'Too many incorrect PIN attempts. Please try again later.',
        lockedUntil: doc.pinLockedUntil.toISOString(),
      },
    };
  }

  // Expired temporary lock → clear only the lock flag, KEEP pinAttempts so the
  // next wrong PIN escalates to the next tier (1m → 3m → 15m → 1h → permanent).
  if (doc.pinLockedUntil && doc.pinLockedUntil <= now) {
    doc.pinLockedUntil = null;
    await doc.save();
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// registerPinFailure(doc, now, contactNote)
//
// Called when a PIN is wrong. Increments the persisted attempt counter,
// stamps lastPinFailAt (used by the 48h reset), applies the escalation
// ladder, saves, and returns the { status, body } descriptor to send.
// ─────────────────────────────────────────────────────────────────
async function registerPinFailure(doc, now, contactNote) {
  doc.pinAttempts   = (doc.pinAttempts || 0) + 1;
  doc.lastPinFailAt = now;
  const attempts    = doc.pinAttempts;

  // attempt 7 → permanent lock
  if (attempts >= PIN_PERMANENT_THRESHOLD) {
    doc.pinPermanentlyLocked = true;
    await doc.save();
    return {
      status: 423,
      body: {
        error: `Your account has been locked due to too many incorrect PIN attempts. Please contact your ${contactNote}.`,
        permanentlyLocked: true,
      },
    };
  }

  // attempts 3–6 → temporary lock of escalating duration
  const lockDuration = getPinLockDuration(attempts);
  if (lockDuration !== null) {
    doc.pinLockedUntil = new Date(now.getTime() + lockDuration);
    await doc.save();
    return {
      status: 423,
      body: {
        error: 'Incorrect PIN. Account locked. Please try again later.',
        lockedUntil: doc.pinLockedUntil.toISOString(),
      },
    };
  }

  // attempts 1–2 → no lock yet, just a warning
  await doc.save();
  const attemptsLeft = PIN_FIRST_LOCK_AT - attempts;
  return {
    status: 403,
    body: {
      error: `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before lockout.`,
    },
  };
}

// On a successful PIN entry, clear all lockout tracking for the account.
function resetPinLockout(doc) {
  doc.pinAttempts    = 0;
  doc.pinLockedUntil = null;
  doc.lastPinFailAt  = null;
}

router.post('/verify-pin', requireAuth, async (req, res, next) => {
  try {
    const { email, pin, propertyId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // ── 1. Try Staff lookup by email ──────────────────────────────
    // Staff accounts are always identified by email first, regardless
    // of what the JWT says. This handles edge cases where a staff member's
    // email might also exist in the User collection.
    const staff = await Staff.findOne({ email: normalizedEmail }).select('+pin +lastPinFailAt');

    if (staff) {
      if (!staff.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
      }

      // ── Lockout pre-check (48h reset, permanent + temp lock, expiry) ──
      const staffBlock = await evaluatePinLockState(staff, now, 'manager');
      if (staffBlock) {
        return res.status(staffBlock.status).json(staffBlock.body);
      }

      if (!propertyId) {
        return res.status(400).json({ error: 'Property selection is required.' });
      }

      // ── Verify PIN ────────────────────────────────────────────────
      const pinMatch = await bcrypt.compare(String(pin), staff.pin || '');

      if (!pinMatch) {
        const failResult = await registerPinFailure(staff, now, 'manager');
        return res.status(failResult.status).json(failResult.body);
      }

      // ── PIN correct — verify property access ──────────────────────
      const hasAccess = (staff.propertyIds || []).some(
        (id) => String(id) === String(propertyId)
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this property.' });
      }

      // ── Reset lockout counters on success ─────────────────────────
      resetPinLockout(staff);
      await staff.save();

      // ── Issue a fresh staff-scoped token ──────────────────────────
      // Critical: the token in sessionStorage right now is the CLIENT's
      // token (stored during /auth/login before PIN). If we don't replace
      // it, every /api/dashboard call runs as req.user = client regardless
      // of who entered the PIN — so staff always see the client's view.
      //
      // The staff token carries clientId in its payload so the auth
      // middleware can do:
      //   req.user  = clientUser  (for smoobuApiKey access)
      //   req.staff = staffRecord (for property-level filtering)
      //   req.isStaff = true
      //
      // This is what allows dashboard.js to use the business account's
      // smoobu API key while still restricting data to the staff member's
      // assigned properties only.
      const staffAccessToken  = signStaffAccessToken(staff);
      const staffRefreshToken = signStaffRefreshToken(staff);

      await RefreshToken.create({
        userId:    staff._id,
        token:     hashToken(staffRefreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.cookie('rt', staffRefreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.json({
        ok:          true,
        accessToken: staffAccessToken,
        // clientId is included so the frontend knows which business account
        // owns the properties/smoobu keys — used by dashboard.js via the
        // staff token's JWT payload (decoded by requireAuth middleware).
        user: {
          ...staff.toJSON(),
          role:     'staff',
          isStaff:  true,
          clientId: staff.clientId.toString(),
        },
      });
    }

    // ── 2. Try User lookup by email ───────────────────────────────
    // Covers client, team_leader, and admin roles.
    // Property access is unrestricted for these roles — only PIN is checked.
    const ownUser = await User.findOne({ email: normalizedEmail }).select('+pin +lastPinFailAt');

    if (!ownUser) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // ── Lockout pre-check (48h reset, permanent + temp lock, expiry) ──
    const userBlock = await evaluatePinLockState(ownUser, now, 'administrator');
    if (userBlock) {
      return res.status(userBlock.status).json(userBlock.body);
    }

    const pinHash = ownUser.pin || null;

    if (!pinHash) {
      return res.status(403).json({ error: 'No PIN configured on this account. Please ask your administrator to set one.' });
    }

    // ── Verify PIN ────────────────────────────────────────────────
    const pinMatch = await bcrypt.compare(String(pin), pinHash);

    if (!pinMatch) {
      const failResult = await registerPinFailure(ownUser, now, 'administrator');
      return res.status(failResult.status).json(failResult.body);
    }

    // ── Reset lockout counters on success ─────────────────────────
    resetPinLockout(ownUser);
    await ownUser.save();

    // ── Issue a fresh user-scoped token ───────────────────────────
    // Same reason as the staff block above: replace whatever token was
    // stored before PIN verification with a correctly-scoped one.
    // For team_leader: dashboard.js will use serverId from req.user to
    // look up the business account's smoobu keys (see dashboard.js fix).
    const userAccessToken  = signAccessToken(ownUser);
    const userRefreshToken = signRefreshToken(ownUser);

    await RefreshToken.create({
      userId:    ownUser._id,
      token:     hashToken(userRefreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.cookie('rt', userRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/auth',
    });

    return res.json({
      ok:          true,
      accessToken: userAccessToken,
      user:        ownUser.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /auth/pin-status  ← TEMPORARY DEBUG ROUTE — remove after fixing
// Tells you whether a PIN is stored on the current account without
// exposing the hash. Safe to call with a valid Bearer token.
// ─────────────────────────────────────────────────────────────────
router.get('/pin-status', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select('+pin');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      email:    user.email,
      role:     user.role,
      hasPin:   !!user.pin,
      pinLength: user.pin ? user.pin.length : 0,
    });
  } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────────────
// GET /auth/debug-staff?email=xxx  ← TEMPORARY DEBUG — remove after fixing
// ─────────────────────────────────────────────────────────────────
router.get('/debug-staff', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });
    const exact = await Staff.findOne({ email: email.toLowerCase() }).lean();
    const fuzzy = await Staff.find({
      email: { $regex: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    }).select('email firstName lastName isActive clientId').lean();
    res.json({ exact: !!exact, exactDoc: exact ? { email: exact.email, firstName: exact.firstName, isActive: exact.isActive } : null, fuzzyMatches: fuzzy });
  } catch (err) { next(err); }
});

export default router;