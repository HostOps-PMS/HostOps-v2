import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { v4 as uuidv4 } from 'uuid';
import { connectDB, disconnectDB } from './config/db.js';
import authRoutes           from './routes/auth.js';
import dashboardRoutes      from './routes/dashboard.js';
import clientsRoutes        from './routes/clients.js';
import propertiesRoutes     from './routes/properties.js';
import staffsRoutes         from './routes/staffs.js';
import accountsRoutes            from './routes/accounts.js';
import dashboardOverviewRoute    from './routes/dashboardOverviewRoute.js';
import { publicRecoveryRouter, adminRecoveryRouter } from './routes/recoveryRequests.js';
import outlookInboxRouter from './routes/outlookInbox.js';
import { requireApiKey } from './middleware/apiKeyAuth.js';
import { encryptApiResponse } from './middleware/encryptResponse.js';
import smoobuApartmentsRoute   from './routes/smoobuApartments.js';
import activityLogRoute        from './routes/activityLog.js';
import imageProxyRoute         from './routes/imageProxy.js';
import smoobuWebhookRoute      from './routes/smoobuWebhook.js';
import ghlProxyRoute           from './routes/ghlProxy.js';
import opsRoutes               from './routes/internal/ops.js';
import announcementsRoute      from './routes/announcements.js';
import { requireAuth }         from './middleware/auth.js';
import { load as loadBlocklistCache } from './utils/blocklistCache.js';

function requireAdmin(req, res, next) {
  const isAdmin = (req.user?.tag === 'Main Admin' && req.user?.role === 'admin')
                || req.user?.email === process.env.ADMIN_ROLE;
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  next();
}
// ── Secret rotation ───────────────────────────────────────────────
// bootstrapSecrets() seeds JWT_SECRET_PREV/CURR/NEXT in .env if they
// don't exist yet (first deploy). startSecretRotation() then rotates
// them in-process every hour so stolen tokens expire within ≤1 hour.
import { bootstrapSecrets, startSecretRotation } from './scripts/rotateSecrets.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Trust Proxy ───────────────────────────────────────────────────────────────
// Production chain (measured): client → Cloudflare → Render LB → app, so
// X-Forwarded-For arrives as "<client>, <cloudflare>". Trusting 2 hops makes
// req.ip the real client (rate limits, audit logs); with 1 every user behind
// the same Cloudflare edge shared one IP. Anything a client puts in the header
// itself sits further left and is ignored. Re-measure if the hosting changes.
app.set('trust proxy', 2);

// ── Request ID ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ── Security Headers (Helmet) ─────────────────────────────────────────────────
const CLOUDINARY_HOSTNAME = 'https://res.cloudinary.com';

// Strip control characters (e.g. \r from Windows line endings) that are
// invisible but illegal inside HTTP headers such as Content-Security-Policy.
const sanitizeOrigin = (o) =>
  o.trim()
   .replace(/[\x00-\x1F\x7F]/g, '')   // remove ASCII control chars
   .replace(/\/$/, '');                 // remove trailing slash

// The image proxy lives on this backend's own origin, so we must allow all
// known frontend origins to load images from it via <img> tags.
const IMAGE_PROXY_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(sanitizeOrigin).filter(Boolean)
  : [
      'https://go.hostops.online',
      'https://hostops-frontend.onrender.com',
      'https://hostops-v2-admin.onrender.com',
      'http://localhost:5000',
    ];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        // Allow images from: self, data URIs, blobs, Cloudinary (direct),
        // the image proxy backend origins, and OpenStreetMap tiles.
        imgSrc:     [
          "'self'",
          'data:',
          'blob:',
          CLOUDINARY_HOSTNAME,
          ...IMAGE_PROXY_ORIGINS,
          'https://*.tile.openstreetmap.org',
          'https://server.arcgisonline.com',
        ],
        connectSrc: [
          "'self'",
          CLOUDINARY_HOSTNAME,
          'https://*.tile.openstreetmap.org',
          'https://tile.openstreetmap.org',
          'http://localhost:5000',
          'http://localhost:5000',
        ],
        fontSrc:    ["'self'"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    // Set to cross-origin so the image proxy route can serve images to
    // frontends on different origins. imageProxy.js also sets this header
    // per-response, but Helmet's global setting must not override it to
    // 'same-origin' or cross-origin <img> loads will be blocked.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge:            31536000,
      includeSubDomains: true,
      preload:           true,
    },
    xFrameOptions: { action: 'sameorigin' },
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(sanitizeOrigin).filter(Boolean)
  : [
      'https://go.hostops.online',
      'https://hostops-frontend.onrender.com',
      'https://hostops-v2-admin.onrender.com',
      'http://localhost:5000',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDev && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'x-api-key', 'X-Session-Hint', 'x-device-fp', 'X-App-Client'],
  })
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ── MongoDB Injection Sanitization ────────────────────────────────────────────
app.use(mongoSanitize());

// ── Mass Assignment Protection ───────────────────────────────────────────────
import { sanitizeRequestBody } from './middleware/sanitizeBody.js';
app.use(sanitizeRequestBody);

// ── Response Encryption ───────────────────────────────────────────────────────
app.use(encryptApiResponse);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const logHit = (req, res, options) => {
  let rawIdentifier = req.body?.email || req.body?.username || '';
  if (typeof rawIdentifier !== 'string') rawIdentifier = String(rawIdentifier);
  
  // 1. Prevent Log Injection/Forging: remove newlines so attackers can't fake log entries
  let cleanIdentifier = rawIdentifier.replace(/[\r\n]/g, '');
  
  // 2. Prevent Log Spam: limit the length of the string printed to the console
  if (cleanIdentifier.length > 100) {
    cleanIdentifier = cleanIdentifier.substring(0, 100) + '...[TRUNCATED]';
  }

  console.warn(`[rate-limit] ${options.name} blocked`, {
    ip: req.ip,
    route: req.originalUrl,
    identifier: cleanIdentifier || null,
  });
  res.status(429).json(options.message);
};

// Per-account limiter key. String() so an array/object email can't throw.
const emailKey = (req) => String(req.body?.email ?? '').trim().toLowerCase() || req.ip;

const globalLimiter = rateLimit({
  windowMs:         1 * 60 * 1000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many requests, please try again later.' },
  skipSuccessfulRequests: true,
});

const authLimiterByIp = rateLimit({
  windowMs:        15 * 60 * 1000, 
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,
  handler: (req, res) => logHit(req, res, {
    name: 'auth-by-ip',
    message: { error: 'Too many authentication attempts, please try again later.' },
  }),
});

const authLimiterByAccount = rateLimit({
  windowMs:        15 * 60 * 1000, 
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: emailKey,
  skipSuccessfulRequests: true,
  handler: (req, res) => logHit(req, res, {
    name: 'auth-by-account',
    message: { error: 'Too many attempts for this account, please try again later.' },
  }),
});

const otpLimiter = rateLimit({
  windowMs:        30 * 60 * 1000, // 30 minutes — matches verify attempt lockout window
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: emailKey,
  skipSuccessfulRequests: true,
  handler: (req, res) => logHit(req, res, {
    name: 'otp-verification',
    message: { error: 'Too many OTP attempts, please wait 30 minutes.' },
  }),
});

// Endpoints that send an email (or queue an admin task) answer 200 whether or
// not the account exists, so skipSuccessfulRequests would never count them.
// This one counts every request: stops email-bombing a user and flooding the
// admin recovery queue.
const emailSendLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10, // admin OTP prompts (key reveal, etc.) also send codes
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    emailKey,
  handler: (req, res) => logHit(req, res, {
    name: 'email-send',
    message: { error: 'Too many requests for this email, please try again later.' },
  }),
});

// New accounts per IP — successful sign-ups count too.
const registerLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => logHit(req, res, {
    name: 'register',
    message: { error: 'Too many sign-ups from this network, please try again later.' },
  }),
});

app.use(globalLimiter);
app.use('/auth/login',            authLimiterByIp, authLimiterByAccount);
app.use('/auth/staff-login',      authLimiterByIp, authLimiterByAccount);
app.use('/auth/register',         authLimiterByIp, registerLimiter);
app.use('/auth/forgot-password',  authLimiterByIp, authLimiterByAccount, emailSendLimiter);
app.use('/auth/reset-password',   authLimiterByIp, authLimiterByAccount);
app.use('/auth/send-login-otp',   authLimiterByIp, authLimiterByAccount, emailSendLimiter);
app.use('/auth/resend-login-otp', authLimiterByIp, authLimiterByAccount, emailSendLimiter);
app.use('/auth/verify-login-otp',   otpLimiter);
app.use('/auth/verify',             otpLimiter);
app.use('/auth/totp/verify',        otpLimiter);
app.use('/auth/resend-verification', authLimiterByIp, authLimiterByAccount, emailSendLimiter);
app.use('/auth/resend-reset',       authLimiterByIp, authLimiterByAccount, emailSendLimiter);
app.use('/auth/recovery-request',   authLimiterByIp, emailSendLimiter);
// Code/PIN checks. '/auth/verify' above does NOT cover these (Express matches
// whole path segments), so each needs its own limiter.
app.use('/auth/verify-reset-token', authLimiterByIp, otpLimiter);
app.use('/auth/verify-pin',         authLimiterByIp, otpLimiter);

// ── Global API Key Protection ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const isAuthRoute     = req.path.startsWith('/auth');
  const isSensitiveAuth = req.path === '/auth/refresh' || req.path === '/auth/logout';
  // Image proxy is intentionally unauthenticated — <img> tags cannot send
  // Authorization headers. Security is enforced inside the route itself
  // (valid MongoDB ObjectIds + DB ownership check + Cloudinary-only whitelist).
  const isImageProxy    = req.path.startsWith('/api/image/');
  // Webhooks authenticate themselves (Smoobu: optional SMOOBU_WEBHOOK_SECRET,
  // inbox: INBOX_WEBHOOK_SECRET); the API key ships in the frontend bundle.
  const isWebhook       = req.path === '/api/smoobu-webhook' || req.path === '/api/inbox/webhook';
  // GHL proxy endpoints are public (used by the landing page, no API key)
  const isGhlProxy      = req.path.startsWith('/api/ghl');

  if (isAuthRoute && !isSensitiveAuth) return next();
  if (isImageProxy) return next();
  if (isWebhook) return next();
  if (isGhlProxy) return next();
  requireApiKey(req, res, next);
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/auth', publicRecoveryRouter);
app.use('/api',  imageProxyRoute);       // No API-key required — see middleware above
app.use('/api/ghl', ghlProxyRoute);      // Public landing page → GHL proxy (rate-limited)
// Public webhooks must be mounted BEFORE any router that applies
// router.use(requireAuth) at the /api level (dashboard, clients, staffs),
// otherwise those routers answer 401 before the webhook is reached.
app.use('/api', smoobuWebhookRoute);     // Smoobu → no auth (idempotent, see route)
app.use('/api',  outlookInboxRouter);    // /inbox/webhook uses its shared secret; other routes are admin-guarded
app.use('/api',  dashboardRoutes);
app.use('/api',  clientsRoutes);
app.use('/api',  activityLogRoute);
app.use('/api',  propertiesRoutes);
app.use('/api',  staffsRoutes);
app.use('/api',  accountsRoutes);
app.use('/api/accounts', smoobuApartmentsRoute);
app.use('/api',  dashboardOverviewRoute);
app.use('/api',  adminRecoveryRouter);
app.use('/api', announcementsRoute);

app.use('/internal/ops', requireAuth, requireAdmin, opsRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const requestId = req.id || 'unknown';

  console.error(`[${new Date().toISOString()}] [req:${requestId}] Error:`, {
    message: err.message,
    stack:   isDev ? err.stack : undefined,
    path:    req.path,
    method:  req.method,
  });

  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden: CORS policy violation' });
  }

  res.status(err.status || 500).json({
    error:     isDev ? err.message : 'Internal server error',
    requestId,
    ...(isDev && { stack: err.stack }),
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
let server;

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    try {
      await disconnectDB();
      console.log('✓ Database disconnected. Process exiting.');
    } catch (err) {
      console.error('Error during DB disconnect:', err);
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => {
    console.error('Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    
    await loadBlocklistCache();
    // Seed missing secret slots on first boot, then start hourly rotation.
    // Must run AFTER dotenv/config loads (import 'dotenv/config' at top)
    // so existing JWT_ACCESS_SECRET is available for the CURR promotion.
    bootstrapSecrets();
    startSecretRotation();

    server = app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();