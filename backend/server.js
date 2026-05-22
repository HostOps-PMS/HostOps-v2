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
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Trust Proxy (required when behind Nginx / load balancer / cloud) ──────────
// Without this, rate limiting sees the proxy IP instead of the real client IP.
app.set('trust proxy', 1);

// ── Request ID (correlation ID for traceable logs) ────────────────────────────
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ── Security Headers (Helmet) ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge:            31536000, // 1 year in seconds
      includeSubDomains: true,
      preload:           true,
    },
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman in dev)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ── MongoDB Injection Sanitization ────────────────────────────────────────────
// Strips keys starting with '$' or containing '.' from req.body, req.params, req.query
app.use(mongoSanitize());

// ── Rate Limiting ─────────────────────────────────────────────────────────────

// Global limiter — broad safety net
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              100,
  standardHeaders:  true,  // Return rate limit info in 'RateLimit-*' headers
  legacyHeaders:    false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth limiter — strict, protects login / register / password-reset
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,              // only 10 attempts per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  skipSuccessfulRequests: true,    // Don't count successful logins against the limit
});

app.use(globalLimiter);
app.use('/auth/login',          authLimiter);
app.use('/auth/register',       authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/auth/reset-password',  authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api',  dashboardRoutes);

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

  // Log with correlation ID so you can trace errors across your logs
  console.error(`[${new Date().toISOString()}] [req:${requestId}] Error:`, {
    message: err.message,
    stack:   process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path:    req.path,
    method:  req.method,
  });

  // CORS errors
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden: CORS policy violation' });
  }

  // Never leak internal error details in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error:     isDev ? err.message : 'Internal server error',
    requestId,                           // lets the client quote an ID in bug reports
    ...(isDev && { stack: err.stack }), // stack trace only in dev
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Ensures in-flight requests finish before the process exits (Docker, k8s, PM2).
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

  // Force-exit after 10 s if something hangs
  setTimeout(() => {
    console.error('Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Unhandled Rejections / Exceptions ─────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1); // Always exit on uncaught exceptions — state is unknown
});

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();