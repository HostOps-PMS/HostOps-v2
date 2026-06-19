// ── GHL Proxy Routes ──────────────────────────────────────────────
// Securely proxies requests from the public landing page to the
// GoHighLevel / LeadConnector API. All sensitive credentials
// (API key, calendar ID, location ID, webhook URLs) live ONLY in
// .env and are NEVER exposed to the browser.
//
// Security layers:
//  1. Strict CORS (inherited from server.js)
//  2. Per-route rate limiting (prevents spam / burst attacks)
//  3. Input validation & sanitization on every endpoint
//  4. No credentials leak — browser never sees GHL tokens
// ──────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();

// ── Environment variables (validated at boot) ────────────────────
const GHL_API_KEY       = process.env.GHL_API_KEY;
const GHL_CALENDAR_ID   = process.env.GHL_CALENDAR_ID;
const GHL_LOCATION_ID   = process.env.GHL_LOCATION_ID;
const GHL_DURATION_MINS = parseInt(process.env.GHL_DURATION_MINS || '30', 10);

const GHL_DEMO_WEBHOOK_URL    = process.env.GHL_DEMO_WEBHOOK_URL;
const GHL_PAYMENT_WEBHOOK_URL = process.env.GHL_PAYMENT_WEBHOOK_URL;
const GHL_CONSULTATION_WEBHOOK_URL = process.env.GHL_CONSULTATION_WEBHOOK_URL;

const GHL_BASE = 'https://services.leadconnectorhq.com';

// Fail-fast: if any critical env vars are missing, log a clear error.
if (!GHL_API_KEY || !GHL_CALENDAR_ID || !GHL_LOCATION_ID) {
  console.error('[ghlProxy] FATAL: Missing GHL_API_KEY, GHL_CALENDAR_ID, or GHL_LOCATION_ID in .env');
}

// ── Rate limiters ────────────────────────────────────────────────
// Slots: generous for calendar browsing (month navigation)
const slotsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // 30 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many calendar requests. Please try again in a few minutes.' },
});

// Booking / contact creation: strict (one real booking per session)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later.' },
});

// Webhooks: very strict (demo signup / payment — should only fire once)
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before trying again.' },
});

// ── Helpers ──────────────────────────────────────────────────────
function ghlHeaders(version) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version': version || '2021-04-15',
  };
}

// Sanitise a string: trim, strip control chars, limit length.
function sanitiseStr(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[\x00-\x1F\x7F]/g, '').substring(0, maxLen);
}

// Validate email format (basic but solid)
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─────────────────────────────────────────────────────────────────
// GET /api/ghl/free-slots?startDate=...&endDate=...
// Fetches available calendar slots from GHL.
// ─────────────────────────────────────────────────────────────────
router.get('/free-slots', slotsLimiter, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate timestamps
    const start = Number(startDate);
    const end   = Number(endDate);
    if (!start || !end || isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }

    // Reject absurd date ranges (max ~35 days)
    if (end - start > 35 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Date range too large' });
    }

    const url = `${GHL_BASE}/calendars/${GHL_CALENDAR_ID}/free-slots?startDate=${start}&endDate=${end}&timezone=Asia%2FManila`;
    const ghlRes = await fetch(url, { headers: ghlHeaders('2021-04-15') });
    const data = await ghlRes.json();

    res.json(data);
  } catch (err) {
    console.error('[ghlProxy] free-slots error:', err.message);
    res.status(502).json({ error: 'Failed to fetch calendar slots' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ghl/contacts/upsert
// Creates or updates a contact in GHL CRM.
// ─────────────────────────────────────────────────────────────────
router.post('/contacts/upsert', bookingLimiter, async (req, res) => {
  try {
    const firstName = sanitiseStr(req.body.firstName, 100);
    const lastName  = sanitiseStr(req.body.lastName, 100);
    const email     = sanitiseStr(req.body.email, 254);

    if (!firstName || !email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid firstName and email are required' });
    }

    const ghlRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders('2021-07-28'),
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        locationId: GHL_LOCATION_ID,
        tags: ['HostPilot Lead'],
      }),
    });

    if (!ghlRes.ok) {
      const errBody = await ghlRes.json().catch(() => ({}));
      console.error('[ghlProxy] contacts/upsert GHL error:', ghlRes.status, errBody);
      return res.status(502).json({ error: 'Failed to create contact' });
    }

    const data = await ghlRes.json();
    res.json(data);
  } catch (err) {
    console.error('[ghlProxy] contacts/upsert error:', err.message);
    res.status(502).json({ error: 'Failed to create contact' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ghl/appointments
// Books a calendar appointment in GHL.
// ─────────────────────────────────────────────────────────────────
router.post('/appointments', bookingLimiter, async (req, res) => {
  try {
    const contactId = sanitiseStr(req.body.contactId, 100);
    const startTime = sanitiseStr(req.body.startTime, 50);
    const endTime   = sanitiseStr(req.body.endTime, 50);
    const title     = sanitiseStr(req.body.title, 200);
    const notes     = sanitiseStr(req.body.notes, 500);

    if (!contactId || !startTime || !endTime) {
      return res.status(400).json({ error: 'contactId, startTime, and endTime are required' });
    }

    // Validate ISO format loosely
    if (!/^\d{4}-\d{2}-\d{2}T/.test(startTime) || !/^\d{4}-\d{2}-\d{2}T/.test(endTime)) {
      return res.status(400).json({ error: 'startTime and endTime must be ISO 8601 format' });
    }

    const ghlRes = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
      method: 'POST',
      headers: ghlHeaders('2021-07-28'),
      body: JSON.stringify({
        calendarId: GHL_CALENDAR_ID,
        locationId: GHL_LOCATION_ID,
        contactId,
        startTime,
        endTime,
        selectedTimezone: 'Asia/Manila',
        title: title || 'Walkthrough',
        appointmentStatus: 'confirmed',
        notes: notes || '',
      }),
    });

    if (!ghlRes.ok) {
      const errBody = await ghlRes.json().catch(() => ({}));
      console.error('[ghlProxy] appointments GHL error:', ghlRes.status, errBody);
      return res.status(502).json({ error: 'Failed to book appointment' });
    }

    const data = await ghlRes.json();
    res.json(data);
  } catch (err) {
    console.error('[ghlProxy] appointments error:', err.message);
    res.status(502).json({ error: 'Failed to book appointment' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ghl/webhook/demo
// Fires the "See How It Works" demo-signup webhook.
// ─────────────────────────────────────────────────────────────────
router.post('/webhook/demo', webhookLimiter, async (req, res) => {
  try {
    if (!GHL_DEMO_WEBHOOK_URL) {
      return res.status(503).json({ error: 'Demo webhook not configured' });
    }

    const firstName     = sanitiseStr(req.body.first_name, 100);
    const lastName      = sanitiseStr(req.body.last_name, 100);
    const email         = sanitiseStr(req.body.email, 254);
    const portfolioSize = sanitiseStr(req.body.portfolio_size, 50);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const ghlRes = await fetch(GHL_DEMO_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        portfolio_size: portfolioSize,
      }),
    });

    res.json({ ok: ghlRes.ok });
  } catch (err) {
    console.error('[ghlProxy] webhook/demo error:', err.message);
    res.status(502).json({ error: 'Webhook delivery failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ghl/webhook/payment
// Fires the payment-intent webhook for the pricing wizard.
// ─────────────────────────────────────────────────────────────────
router.post('/webhook/payment', webhookLimiter, async (req, res) => {
  try {
    if (!GHL_PAYMENT_WEBHOOK_URL) {
      return res.status(503).json({ error: 'Payment webhook not configured' });
    }

    const firstName  = sanitiseStr(req.body.first_name, 100);
    const lastName   = sanitiseStr(req.body.last_name, 100);
    const email      = sanitiseStr(req.body.email, 254);
    const plan       = sanitiseStr(req.body.plan, 100);
    const properties = sanitiseStr(req.body.properties, 100);
    const platforms  = sanitiseStr(req.body.platforms, 300);
    const setupFee   = sanitiseStr(req.body.setup_fee, 50);
    const source     = sanitiseStr(req.body.source, 100);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const ghlRes = await fetch(GHL_PAYMENT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        plan,
        properties,
        platforms,
        payment_status: 'Pending - Awaiting GCash Confirmation',
        setup_fee: setupFee || '$2,000.00',
        source: source || 'HostPilot Website',
      }),
    });

    res.json({ ok: ghlRes.ok });
  } catch (err) {
    console.error('[ghlProxy] webhook/payment error:', err.message);
    res.status(502).json({ error: 'Webhook delivery failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ghl/webhook/consultation
// Fires the consultation form webhook for the contact page.
// ─────────────────────────────────────────────────────────────────
router.post('/webhook/consultation', webhookLimiter, async (req, res) => {
  try {
    if (!GHL_CONSULTATION_WEBHOOK_URL) {
      return res.status(503).json({ error: 'Consultation webhook not configured' });
    }

    const firstName  = sanitiseStr(req.body.first_name, 100);
    const lastName   = sanitiseStr(req.body.last_name, 100);
    const email      = sanitiseStr(req.body.email, 254);
    const phone      = sanitiseStr(req.body.phone, 50);
    const numProps   = sanitiseStr(req.body.number_of_properties, 50);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const ghlRes = await fetch(GHL_CONSULTATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        number_of_properties: numProps,
      }),
    });

    res.json({ ok: ghlRes.ok });
  } catch (err) {
    console.error('[ghlProxy] webhook/consultation error:', err.message);
    res.status(502).json({ error: 'Webhook delivery failed' });
  }
});

export default router;
