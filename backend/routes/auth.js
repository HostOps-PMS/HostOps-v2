// src/routes/auth.js
import express from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import Staff from '../models/staff.js';
import ClientAccount from '../models/clientAccount.js';
import RefreshToken from '../models/refreshToken.js';
import TrustedDevice from '../models/trustedDevice.js';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  signStaffAccessToken, signStaffRefreshToken,
  signClientAccountAccessToken, signClientAccountRefreshToken,
  refreshTokenExpiry, randomToken, hashToken,
} from '../utils/tokens.js';
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
      await sendVerificationEmail(user.email, user.firstName, rawToken);
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
// only needs one login endpoint. Staff are detected by checking the
// Staff model when no matching User is found (or password doesn't match).
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { email, password, deviceId } = data;

    // ── Check if this is a client account login FIRST ─────────────
    // Client accounts must be checked before User because the same email
    // could exist in both collections (e.g. the parent client's email was
    // reused). Client accounts never go through the OTP flow.
    const clientAccount = await ClientAccount.findOne({ email: email.toLowerCase() }).select('+password');
    if (clientAccount && (await clientAccount.comparePassword(password))) {
      if (!clientAccount.isActive) {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your manager.' });
      }

      const accessToken  = signClientAccountAccessToken(clientAccount);
      const refreshToken = signClientAccountRefreshToken(clientAccount);

      await RefreshToken.create({
        userId:    clientAccount._id,
        token:     hashToken(refreshToken),
        expiresAt: refreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      clientAccount.lastLoginAt = new Date();
      await clientAccount.save();

      res.cookie('rt', refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/auth',
      });

      return res.json({
        accessToken,
        clientAccount:      { ...clientAccount.toJSON(), role: 'clientAccount', isClientAccount: true },
        mustChangePassword: clientAccount.mustChangePassword,
        isClientAccount:    true,
      });
    }

    // ── Check if this is a staff login ────────────────────────────
    // Try User first. If not found or password wrong, try Staff.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    const userPasswordMatch = user && (await user.comparePassword(password));

    if (!userPasswordMatch) {
      // Try staff login
      const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+password');
      if (staff && (await staff.comparePassword(password))) {
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

      // Neither user nor staff matched
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
          await sendVerificationEmail(user.email, user.firstName, rawOtp);
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

    // ── Fall back to ClientAccount ─────────────────────────────────
    const clientAccount = await ClientAccount.findOne({
      email:          normalizedEmail,
      loginOtp:       hashedOtp,
      loginOtpExpiry: { $gt: now },
    }).select('+loginOtp +loginOtpExpiry');

    if (!clientAccount) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    clientAccount.loginOtp       = undefined;
    clientAccount.loginOtpExpiry = undefined;

    const accessToken  = signClientAccountAccessToken(clientAccount);
    const refreshToken = signClientAccountRefreshToken(clientAccount);

    await RefreshToken.create({
      userId:    clientAccount._id,
      token:     hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    clientAccount.lastLoginAt = new Date();
    await clientAccount.save();

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/auth',
    });

    return res.json({
      accessToken,
      clientAccount: { ...clientAccount.toJSON(), role: 'clientAccount', isClientAccount: true },
      isClientAccount: true,
    });
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

    // Try User first, then fall back to ClientAccount.
    const user          = await User.findOne({ email: normalizedEmail });
    const clientAccount = !user
      ? await ClientAccount.findOne({ email: normalizedEmail })
      : null;

    const account = user || clientAccount;

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

    // Try User first, then fall back to ClientAccount.
    const user          = await User.findOne({ email: normalizedEmail });
    const clientAccount = !user
      ? await ClientAccount.findOne({ email: normalizedEmail })
      : null;

    const account = user || clientAccount;

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

    // ── Client Account refresh ─────────────────────────────────────
    if (decoded.role === 'clientAccount') {
      const clientAccount = await ClientAccount.findById(decoded.clientAccountId || decoded.sub);
      if (!clientAccount || !clientAccount.isActive) {
        return res.status(401).json({ error: 'Client account not found or inactive' });
      }

      const newRefreshToken = signClientAccountRefreshToken(clientAccount);
      stored.revokedAt  = new Date();
      stored.replacedBy = hashToken(newRefreshToken);
      await stored.save();

      await RefreshToken.create({
        userId:    clientAccount._id,
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

      return res.json({ accessToken: signClientAccountAccessToken(clientAccount) });
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

    // ── Client Account change-password ─────────────────────────────
    if (req.isClientAccount) {
      const clientAccount = await ClientAccount.findById(req.clientAccount._id).select('+password');
      if (!clientAccount) return res.status(404).json({ error: 'Client account not found' });

      const isMatch = await clientAccount.comparePassword(currentPassword);
      if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from the current one' });
      }

      clientAccount.password           = newPassword;
      clientAccount.mustChangePassword = false;
      await clientAccount.save();

      await RefreshToken.updateMany(
        { userId: clientAccount._id, revokedAt: null },
        { revokedAt: new Date() }
      );

      return res.json({ message: 'Password changed successfully.', clientAccount: clientAccount.toJSON() });
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

    // Complete first-login verification: the user has proven ownership of the
    // account by logging in with the temporary password and choosing a new one.
    if (user.mustChangePassword) {
      user.mustChangePassword = false;
      user.isVerified = true;
    }

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
        await sendResetEmail(user.email, user.firstName, rawToken);
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

    // ── ClientAccount fallback ────────────────────────────────────
    // ClientAccount uses loginOtp/loginOtpExpiry (same as Staff).
    const clientAccount = await ClientAccount.findOne({ email: normalizedEmail })
      .select('+loginOtp +loginOtpExpiry');

    if (
      clientAccount &&
      clientAccount.loginOtp === hashed &&
      clientAccount.loginOtpExpiry &&
      clientAccount.loginOtpExpiry > now
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
      await sendVerificationEmail(user.email, user.firstName, rawToken);
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
        await sendResetEmail(user.email, user.firstName, rawToken);
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

    // ── Client Account ─────────────────────────────────────────────
    if (req.isClientAccount) {
      const clientAccount = await ClientAccount.findById(req.clientAccount._id);
      if (!clientAccount) return res.status(404).json({ error: 'Client account not found.' });

      clientAccount.loginOtp       = hashed;
      clientAccount.loginOtpExpiry = expiry;
      await clientAccount.save();

      try {
        await sendResetEmail(clientAccount.email, clientAccount.firstName, rawToken);
      } catch (e) {
        console.error('Client account change-password OTP send failed:', e);
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
      await sendResetEmail(user.email, user.firstName, rawToken);
    } catch (e) {
      console.error('User change-password OTP send failed:', e);
    }

    res.json({ message: 'A verification code has been sent to your email.' });
  } catch (err) { next(err); }
});

export default router;