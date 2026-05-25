// src/routes/dashboard.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getApartments, getBookings, getRates, getDashboard,
  getReservationMessages, sendReplyToGuest
} from '../services/smoobu.js';

const router = express.Router();

// All routes here require auth
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────
// Filtering strategy
// ─────────────────────────────────────────────────────────────────
//
// MODE A — per-user Smoobu API key (preferred, correct mode)
//   user.smoobuApiKey is set → smoobu service uses it → Smoobu already
//   scopes the response to that account → no further filtering needed.
//
// MODE B — shared global Smoobu key + propertyTagPrefix (legacy/fallback)
//   user.smoobuApiKey is null → smoobu service falls back to
//   process.env.SMOOBU_API_KEY → all users hit the same Smoobu account
//   → we filter by propertyTagPrefix so each user sees only their subset.
//
// The root cause of "baligtad" (inverted data) was:
//   smoobuApiKey was never loaded (select:false, not overridden in
//   requireAuth) → always null → everyone used the env key → everyone
//   saw the same account's data, not their own.
// ─────────────────────────────────────────────────────────────────

/** True when the user has their own Smoobu API key loaded on req.user. */
function hasOwnApiKey(user) {
  return !!(user.smoobuApiKey && user.smoobuApiKey.trim());
}

/**
 * Returns the prefix-filtered subset of properties (and their ID Set).
 * Only used in MODE B (shared key).
 */
function filterPropsByPrefix(allProperties = [], prefix = '') {
  if (!prefix) {
    // Empty prefix + shared key = admin seeing everything
    return { props: allProperties, propIds: new Set(allProperties.map((p) => p.id)) };
  }
  const props = allProperties.filter((p) => p.name && p.name.startsWith(prefix));
  return { props, propIds: new Set(props.map((p) => p.id)) };
}

/**
 * Re-calculates stats and byChannel from a filtered booking set.
 * Called after MODE B filtering so stat cards stay consistent.
 */
function recalcStats(filteredBookings = [], filteredProps = [], period = {}) {
  const active    = filteredBookings.filter((b) => b.type !== 'cancellation');
  const cancelled = filteredBookings.filter((b) => b.type === 'cancellation');

  const nightCount = (b) =>
    Math.max(0, Math.round((new Date(b.departure) - new Date(b.arrival)) / 864e5));

  const revenue = active.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const nights  = active.reduce((s, b) => s + nightCount(b), 0);

  const byChannel = {};
  active.forEach((b) => {
    const ch = b.channel?.name || 'Direct';
    if (!byChannel[ch]) byChannel[ch] = { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price) || 0;
    byChannel[ch].bookings += 1;
    byChannel[ch].nights   += nightCount(b);
  });

  let occupancy = 0;
  if (filteredProps.length > 0 && period.from && period.to) {
    const totalDays     = Math.max(1, Math.round((new Date(period.to) - new Date(period.from)) / 864e5));
    const totalPropDays = filteredProps.length * totalDays;
    occupancy = Math.min(100, Math.round((nights / totalPropDays) * 100));
  }

  return {
    stats: { revenue, bookings: active.length, cancellations: cancelled.length, nights, occupancy },
    byChannel,
  };
}

// ─────────────────────────────────────────────────────────────────
// GET /api/dashboard
// ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await getDashboard(req.user, {
      from: req.query.from,
      to:   req.query.to,
    });

    // MODE A: user has own API key → smoobu already scoped the data correctly
    if (hasOwnApiKey(req.user)) {
      return res.json(data);
    }

    // MODE B: shared key → apply propertyTagPrefix filter
    const prefix = (req.user.propertyTagPrefix || '').trim();
    if (prefix) {
      const { props, propIds } = filterPropsByPrefix(data.properties || [], prefix);

      const filteredBookings = (data.bookings || []).filter(
        (b) => b.apartment && propIds.has(b.apartment.id)
      );
      const filteredInbox = (data.inbox || []).filter(
        (t) => t.apartment && propIds.has(t.apartment.id)
      );

      const { stats, byChannel } = recalcStats(filteredBookings, props, data.period);

      data.properties  = props;
      data.bookings    = filteredBookings;
      data.inbox       = filteredInbox;
      data.stats       = stats;
      data.byChannel   = byChannel;
      data.totalUnread = filteredInbox.reduce((s, t) => s + (t.unread || 0), 0);
    }

    res.json(data);
  } catch (err) {
    // User has no Smoobu API key configured yet — return a clean empty
    // dashboard with a flag the frontend can use to show a connect prompt.
    // This is NOT a 500: it is an expected state for newly registered users
    // who haven't linked their Smoobu account yet.
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({
        smoobuNotConnected: true,
        message: err.message,
        period:      {},
        stats:       { revenue: 0, bookings: 0, cancellations: 0, nights: 0, occupancy: 0 },
        byChannel:   {},
        properties:  [],
        bookings:    [],
        inbox:       [],
        totalUnread: 0,
      });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/properties
// ─────────────────────────────────────────────────────────────────
router.get('/properties', async (req, res, next) => {
  try {
    const data = await getApartments(req.user);

    if (!hasOwnApiKey(req.user)) {
      const prefix = (req.user.propertyTagPrefix || '').trim();
      if (prefix && data.apartments) {
        data.apartments = filterPropsByPrefix(data.apartments, prefix).props;
      }
    }

    res.json(data);
  } catch (err) {
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({ smoobuNotConnected: true, message: err.message, apartments: [] });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/bookings?from=&to=&apartmentId=
// ─────────────────────────────────────────────────────────────────
router.get('/bookings', async (req, res, next) => {
  try {
    const data = await getBookings(req.user, req.query);

    if (!hasOwnApiKey(req.user)) {
      const prefix = (req.user.propertyTagPrefix || '').trim();
      if (prefix && data.bookings) {
        const allProps  = await getApartments(req.user);
        const { propIds } = filterPropsByPrefix(allProps.apartments || [], prefix);
        data.bookings = data.bookings.filter(
          (b) => b.apartment && propIds.has(b.apartment.id)
        );
      }
    }

    res.json(data);
  } catch (err) {
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({ smoobuNotConnected: true, message: err.message, bookings: [] });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/rates?apartmentIds=1,2&start=&end=
// ─────────────────────────────────────────────────────────────────
router.get('/rates', async (req, res, next) => {
  try {
    const { apartmentIds, start, end } = req.query;
    if (!apartmentIds || !start || !end) {
      return res.status(400).json({ error: 'apartmentIds, start, end required' });
    }

    let requestedIds = apartmentIds.split(',').map((id) => id.trim());

    // In MODE B, restrict to only the user's authorised properties
    if (!hasOwnApiKey(req.user)) {
      const prefix = (req.user.propertyTagPrefix || '').trim();
      if (prefix) {
        const allProps  = await getApartments(req.user);
        const { propIds } = filterPropsByPrefix(allProps.apartments || [], prefix);
        requestedIds = requestedIds.filter(
          (id) => propIds.has(Number(id)) || propIds.has(id)
        );
        if (!requestedIds.length) {
          return res.status(403).json({ error: 'None of the requested apartments belong to your account' });
        }
      }
    }

    const data = await getRates(req.user, { apartmentIds: requestedIds, start, end });
    res.json(data);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// Ownership guard for message endpoints
// In MODE A: all reservations returned by the API already belong to
//   the user's account — no extra check needed.
// In MODE B: verify the reservation's apartment is in the user's prefix set.
// ─────────────────────────────────────────────────────────────────
async function assertReservationOwnership(user, reservationId) {
  if (hasOwnApiKey(user)) return; // API key already scopes access

  const prefix = (user.propertyTagPrefix || '').trim();
  if (!prefix) return; // admin / no prefix = no restriction

  const allProps   = await getApartments(user);
  const { propIds } = filterPropsByPrefix(allProps.apartments || [], prefix);

  const { bookings = [] } = await getBookings(user, {});
  const reservation = bookings.find((b) => String(b.id) === String(reservationId));

  if (!reservation) {
    const err = new Error('Reservation not found'); err.status = 404; throw err;
  }
  if (!propIds.has(reservation.apartment?.id)) {
    const err = new Error('Unauthorized: reservation does not belong to your properties');
    err.status = 403; throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/messages/reply
// ─────────────────────────────────────────────────────────────────
router.post('/messages/reply', async (req, res, next) => {
  try {
    const { reservationId, subject, messageBody } = req.body;
    if (!reservationId || !messageBody) {
      return res.status(400).json({ error: 'reservationId and messageBody are required' });
    }

    await assertReservationOwnership(req.user, reservationId);

    const result = await sendReplyToGuest(req.user, reservationId, { subject, messageBody });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.status === 403 || err.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.status === 404 || err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/messages/:reservationId
// ─────────────────────────────────────────────────────────────────
router.get('/messages/:reservationId', async (req, res, next) => {
  try {
    await assertReservationOwnership(req.user, req.params.reservationId);

    const data = await getReservationMessages(req.user, req.params.reservationId);
    res.json(data);
  } catch (err) {
    if (err.status === 403 || err.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.status === 404 || err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

export default router;