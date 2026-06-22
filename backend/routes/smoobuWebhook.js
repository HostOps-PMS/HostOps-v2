import express from 'express';
import ActivityLog from '../models/activityLog.js';
import User from '../models/user.js';

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
router.post('/smoobu-webhook', async (req, res) => {
  try {
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

    // ── Idempotency check: skip if we already processed this exact event ──
    const idempotencyKey = `${action}:${resId}:${apartmentId}`;
    if (isDuplicate(idempotencyKey)) {
      console.log(`[SmoobuWebhook] Duplicate skipped: ${idempotencyKey}`);
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const guestName = data['guest-name'] || data.guestName || (data.firstname ? `${data.firstname || ''} ${data.lastname || ''}`.trim() : 'Guest');
    const arrival   = data.arrival || data.check_in;
    const departure = data.departure || data.check_out;
    const price     = data.price || data.total_price || 0;
    const channel   = data.channel?.name || data.channel || 'Direct';
    const nights    = computeNights(arrival, departure);
    const propName  = data.apartment?.name || data.propertyName || '';

    // ── Atomic lookup — .lean() ensures no Mongoose document overhead ──
    let owner = null;
    if (apartmentId) {
      owner = await User.findOne(
        { 'properties.subProperties.smoobuId': String(apartmentId) },
        { _id: 1, email: 1, firstName: 1, lastName: 1, businessName: 1, properties: 1 }
      ).lean();
    }

    if (!owner?._id) {
      console.warn(`[SmoobuWebhook] No owner for apartment ${apartmentId}`);
      return res.status(200).json({ ok: true });
    }

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
        currency: data.currency || 'PHP',
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
