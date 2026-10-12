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
// POST /api/ghl/appointments
// Books the walkthrough for the visitor in one server-side step:
// creates/updates their contact, then books a free slot for it.
// The browser never sees or chooses a contact id, title or end time,
// so an anonymous caller cannot book for someone else's contact or
// put their own text into the calendar invite.
// ─────────────────────────────────────────────────────────────────
router.post('/appointments', bookingLimiter, async (req, res) => {
  try {
    const firstName  = sanitiseStr(req.body.firstName, 100);
    const lastName   = sanitiseStr(req.body.lastName, 100);
    const email      = sanitiseStr(req.body.email, 254);
    const properties = sanitiseStr(req.body.properties, 100);
    const platforms  = sanitiseStr(req.body.platforms, 300);
    const start      = new Date(sanitiseStr(req.body.startTime, 50));

    if (!firstName || !email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid firstName and email are required' });
    }
    if (isNaN(start) || start <= Date.now() || start - Date.now() > 90 * 864e5) {
      return res.status(400).json({ error: 'startTime must be a future date within 90 days' });
    }

    // Only book a time GHL itself offers as free.
    const day = 864e5;
    const slotsRes = await fetch(
      `${GHL_BASE}/calendars/${GHL_CALENDAR_ID}/free-slots?startDate=${start - day}&endDate=${+start + day}&timezone=Asia%2FManila`,
      { headers: ghlHeaders('2021-04-15') },
    );
    const slotsData = slotsRes.ok ? await slotsRes.json() : {};
    const offered = Object.values(slotsData || {}).flatMap((d) => (Array.isArray(d?.slots) ? d.slots : []));
    if (!offered.some((s) => new Date(s).getTime() === start.getTime())) {
      return res.status(409).json({ error: 'That time is no longer available. Please pick another slot.' });
    }

    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders('2021-07-28'),
      body: JSON.stringify({ firstName, lastName, email, locationId: GHL_LOCATION_ID, tags: ['HostPilot Lead'] }),
    });
    const contactId = contactRes.ok ? (await contactRes.json())?.contact?.id : null;
    if (!contactId) {
      console.error('[ghlProxy] appointments: contact upsert failed:', contactRes.status);
      return res.status(502).json({ error: 'Failed to book appointment' });
    }

    const ghlRes = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
      method: 'POST',
      headers: ghlHeaders('2021-07-28'),
      body: JSON.stringify({
        calendarId: GHL_CALENDAR_ID,
        locationId: GHL_LOCATION_ID,
        contactId,
        startTime: start.toISOString(),
        endTime: new Date(+start + GHL_DURATION_MINS * 60e3).toISOString(),
        selectedTimezone: 'Asia/Manila',
        // Fixed: the email is unverified, so typed names must not reach a stranger's invite.
        // The name is already on the contact record.
        title: 'Walkthrough',
        appointmentStatus: 'confirmed',
        notes: `Properties: ${properties} | Platforms: ${platforms}`,
      }),
    });

    if (!ghlRes.ok) {
      const errBody = await ghlRes.json().catch(() => ({}));
      console.error('[ghlProxy] appointments GHL error:', ghlRes.status, errBody);
      return res.status(502).json({ error: 'Failed to book appointment' });
    }

    // Nothing from GHL goes back to an anonymous caller.
    res.json({ ok: true });
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

// Accepts the plan key ('starter' | 'growth') or the older label the landing page sends
// ('Starter - $1,500/mo'): only the first word is read, the price always comes from here.
// Null prototype: 'constructor' / '__proto__' must not count as plans.
const PAYMENT_PLANS = { __proto__: null, starter: 'Starter - $1,500/mo', growth: 'Growth - $2,500/mo' };
const SETUP_FEE = '$2,000.00';

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
    const plan       = PAYMENT_PLANS[sanitiseStr(req.body.plan, 100).toLowerCase().split(' ')[0]];
    const properties = sanitiseStr(req.body.properties, 100);
    const platforms  = sanitiseStr(req.body.platforms, 300);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!plan) {
      return res.status(400).json({ error: 'Unknown plan' });
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
        // Price, fee and status are set here, never by the browser. This is a
        // payment *intent*: the GHL workflow must still wait for a confirmed GCash payment.
        payment_status: 'Pending - Awaiting GCash Confirmation',
        setup_fee: SETUP_FEE,
        source: 'HostPilot Website',
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
