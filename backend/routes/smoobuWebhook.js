import express from 'express';
import ActivityLog from '../models/activityLog.js';
import User from '../models/user.js';

const router = express.Router();

function computeNights(arrival, departure) {
  if (!arrival || !departure) return 0;
  const a = new Date(arrival);
  const d = new Date(departure);
  return Math.max(0, Math.round((d - a) / 86400000));
}

// ═══════════════════════════════════════════════════════════════
// POST /api/smoobu-webhook
// Receives booking events from Smoobu and creates ActivityLog entries.
// Smoobu sends: { action, data } where action is one of:
//   newReservation, updateReservation, cancelReservation
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

    const apartmentId = data.apartment?.id || data.apartmentId;
    const guestName   = data['guest-name'] || data.guestName || data.firstname ? `${data.firstname || ''} ${data.lastname || ''}`.trim() : 'Guest';
    const arrival     = data.arrival || data.check_in;
    const departure   = data.departure || data.check_out;
    const price       = data.price || data.total_price || 0;
    const channel     = data.channel?.name || data.channel || 'Direct';
    const nights      = computeNights(arrival, departure);
    const propName    = data.apartment?.name || data.propertyName || '';
    const resId       = data.id || data.reservationId;

    // Find the owner user by matching the apartment ID in their properties
    let owner = null;
    if (apartmentId) {
      owner = await User.findOne({
        'properties.subProperties.smoobuId': String(apartmentId),
      }).lean();
    }

    const userId = owner?._id;
    if (!userId) {
      console.warn(`[SmoobuWebhook] No owner found for apartment ${apartmentId}, skipping log`);
      return res.status(200).json({ ok: true });
    }

    await ActivityLog.create({
      userId,
      staffId: null,
      performedBy: {
        userId,
        email: owner.email || '',
        firstName: owner.firstName || '',
        lastName: owner.lastName || '',
        role: 'system',
      },
      businessName: owner.businessName || '',
      properties: (owner.properties || []).map(p => ({ id: p._id, propertyName: p.propertyName || '' })),
      action: logAction,
      meta: {
        reservationId: resId,
        guestName,
        arrival,
        departure,
        propertyName: propName,
        apartmentId,
        price: Number(price) || 0,
        currency: data.currency || 'PHP',
        channel,
        nights,
        source: 'smoobu',
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
