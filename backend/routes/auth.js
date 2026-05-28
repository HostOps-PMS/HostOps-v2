// src/routes/auth.js
import express from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import RefreshToken from '../models/refreshToken.js';
import TrustedDevice from '../models/trustedDevice.js';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  refreshTokenExpiry, randomToken, hashToken
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
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
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

    if (!isAdmin) {
      let isTrusted = false;
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

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    user.lastLoginAt = new Date();
    await user.save();

    res.cookie('rt', refreshToken, {
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

// POST /auth/verify-login-otp
router.post('/verify-login-otp', async (req, res, next) => {
  try {
    const { email, otp, deviceId, rememberMe } = req.body;
    if (!email || !otp || !deviceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      loginOtp: hashToken(otp),
      loginOtpExpiry: { $gt: new Date() },
    }).select('+loginOtp +loginOtpExpiry');

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    user.loginOtp = undefined;
    user.loginOtpExpiry = undefined;
    
    if (rememberMe) {
      // --- 14-day expiration (adjust here for debugging) ---
      // 3 seconds.
      // const expiresIn = 3000;
      // 30 seconds.
      const expiresIn = 30000;
      // 1 minute.
      // const expiresIn = 60000;
      // 14 days.
      // const expiresIn = 14 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + expiresIn);

      await TrustedDevice.findOneAndUpdate(
        { userId: user._id, deviceId },
        { expiresAt },
        { upsert: true, new: true },
      );
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    user.lastLoginAt = new Date();
    await user.save();

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    const isAdmin = user.tag === "Main Admin" || user.role === "admin" || user.email === process.env.ADMIN_ROLE;

    res.json({
      accessToken,
      user: user.toJSON(),
      isAdmin,
    });
  } catch (err) { next(err); }
});

// POST /auth/send-login-otp
// Called by the admin AuthModal on mount to trigger the initial OTP email.
router.post('/send-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Respond with success even if user not found (avoid enumeration)
      return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    }

    const rawOtp = randomToken();
    user.loginOtp = hashToken(rawOtp);
    user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.firstName, rawOtp);
    } catch (e) {
      console.error('Login OTP email send failed:', e);
    }

    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/resend-login-otp
// Re-generates and re-sends the login OTP for a given email.
router.post('/resend-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ message: 'If that email is registered, a new code has been sent.' });
    }

    const rawOtp = randomToken();
    user.loginOtp = hashToken(rawOtp);
    user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.firstName, rawOtp);
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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const rawToken = randomToken();
      user.resetToken = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendResetEmail(user.email, user.firstName, rawToken);
      } catch (e) {
        console.error('Reset email send failed:', e);
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
// Used to silently verify the 6-digit OTP before asking for new password
router.post('/verify-reset-token', async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: 'Email and token required' });

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: hashToken(token),
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');

    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const rawToken = randomToken();
      user.resetToken = hashToken(rawToken);
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendResetEmail(user.email, user.firstName, rawToken);
      } catch (e) {
        console.error('Reset email send failed:', e);
      }
    }

    res.json({ message: 'If registered, a new code has been sent.' });
  } catch (err) { next(err); }
});

export default router;