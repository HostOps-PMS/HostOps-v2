import express from 'express';
import crypto from 'crypto';
import ActivityLog from '../models/activityLog.js';
import User from '../models/user.js';
import { smoobuFetch } from '../services/smoobu.js';

const router = express.Router();

// ── Idempotency: track processed webhook events to prevent duplicates ────────
const processedEvents = new Map();
const DEDUP_TTL = 5 * 60 * 1000; // 5 minutes

function isDuplicate(key) {
  const now = Date.now();
  // Clean expired entries
  for (const [k, t] of processedEvents) {
    if (now - t > DEDUP_TTL) processedEvents.delete(k);
  }
  if (processedEvents.has(key)) return true;
  processedEvents.set(key, now);
  return false;
}

function computeNights(arrival, departure) {
  if (!arrival || !departure) return 0;
  const a = new Date(arrival);
  const d = new Date(departure);
  return Math.max(0, Math.round((d - a) / 86400000));
}

// ═══════════════════════════════════════════════════════════════
// POST /api/smoobu-webhook
// Receives booking events from Smoobu. Uses idempotency key
// to prevent duplicate processing from parallel webhook calls.
// Uses atomic MongoDB operations instead of read-then-write.
// ═══════════════════════════════════════════════════════════════
// Optional shared secret. Smoobu cannot sign requests, so when
// SMOOBU_WEBHOOK_SECRET is set, register the webhook URL as
// /api/smoobu-webhook?secret=<value> (or send x-webhook-secret).
// Unset → accepted as before, so existing Smoobu setups keep working.
function webhookSecretOk(req) {
  const expected = process.env.SMOOBU_WEBHOOK_SECRET;
  if (!expected) return true;
  const given = String(req.query.secret || req.headers['x-webhook-secret'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/smoobu-webhook', async (req, res) => {
  try {
    if (!webhookSecretOk(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { action, data } = req.body;
    if (!action || !data) return res.status(200).json({ ok: true });

    const actionMap = {
      newReservation:    'booking_created',
      updateReservation: 'booking_modified',
      cancelReservation: 'booking_cancelled',
    };

    const logAction = actionMap[action];
    if (!logAction) return res.status(200).json({ ok: true });

    const resId       = data.id || data.reservationId;
    const apartmentId = data.apartment?.id || data.apartmentId;
    if (!/^\d+$/.test(String(resId)) || !/^\d+$/.test(String(apartmentId))) return res.status(200).json({ ok: true });

    const idempotencyKey = `${action}:${resId}:${apartmentId}`;

    // Full document (not .lean()) so the property's key/secret getters decrypt.
    const owner = await User.findOne(
      { 'properties.subProperties.smoobuId': String(apartmentId) },
      { _id: 1, email: 1, firstName: 1, lastName: 1, businessName: 1, properties: 1 }
    );
    if (!owner?._id) {
      console.warn(`[SmoobuWebhook] No owner for apartment ${apartmentId}`);
      return res.status(200).json({ ok: true });
    }

    // Anyone can POST here and Smoobu can't sign requests, so never trust the
    // body: re-fetch the reservation from Smoobu with the owner's own key and
    // log Smoobu's data. A forged or foreign reservation id fails this check.
    const property = owner.properties.find((p) => (p.subProperties || []).some((sp) => sp.smoobuId === String(apartmentId)));
    const creds    = { apiKey: property?.smoobuApiKey, apiSecret: property?.smoobuApiSecret };
    let booking = null;
    try {
      const r = await smoobuFetch(`/reservations/${resId}`, {}, creds);
      if (r.ok) booking = await r.json();
    } catch (err) {
      console.warn(`[SmoobuWebhook] could not verify reservation ${resId}: ${err.message}`);
    }
    if (!booking || String(booking.apartment?.id ?? booking.apartmentId) !== String(apartmentId)) {
      console.warn(`[SmoobuWebhook] Unverified event ignored: ${idempotencyKey}`);
      return res.status(200).json({ ok: true });
    }

    // Idempotency AFTER verification, so a forged request can't mark a real
    // event as "already processed" and suppress it.
    if (isDuplicate(idempotencyKey)) {
      console.log(`[SmoobuWebhook] Duplicate skipped: ${idempotencyKey}`);
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const guestName = booking['guest-name'] || booking.guestName || (booking.firstname ? `${booking.firstname || ''} ${booking.lastname || ''}`.trim() : 'Guest');
    const arrival   = booking.arrival || booking.check_in;
    const departure = booking.departure || booking.check_out;
    const price     = booking.price || booking.total_price || 0;
    const channel   = booking.channel?.name || booking.channel || 'Direct';
    const nights    = computeNights(arrival, departure);
    const propName  = booking.apartment?.name || data.propertyName || '';

    // ── Atomic insert — single operation, no read-then-write ──
    await ActivityLog.create({
      userId:      owner._id,
      staffId:     null,
      performedBy: {
        userId:    owner._id,
        email:     owner.email || '',
        firstName: owner.firstName || '',
        lastName:  owner.lastName || '',
        role:      'system',
      },
      businessName: owner.businessName || '',
      properties:   (owner.properties || []).map(p => ({ id: p._id, propertyName: p.propertyName || '' })),
      action:       logAction,
      meta: {
        reservationId: resId,
        guestName, arrival, departure,
        propertyName: propName, apartmentId,
        price: Number(price) || 0,
        currency: booking.currency || data.currency || 'PHP',
        channel, nights, source: 'smoobu',
      },
      ipAddress: 'smoobu-webhook',
      userAgent: 'Smoobu/webhook',
    });

    console.log(`[SmoobuWebhook] Logged ${logAction} for reservation ${resId}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[SmoobuWebhook] Error:', err.message);
    res.status(200).json({ ok: true });
  }
});

export default router;
