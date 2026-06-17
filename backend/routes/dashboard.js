// src/routes/dashboard.js
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/user.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getApartments, getBookings, getRates, getDashboard,
  getReservationMessages, sendReplyToGuest
} from '../services/smoobu.js';

const router = express.Router();

// All routes here require auth
router.use(requireAuth);

// ── Reload user with smoobuApiKey ─────────────────────────────────────────────
// requireAuth loads the user WITHOUT smoobuApiKey (it has select:false in the
// schema).  Every route in this file needs the key to call the Smoobu API, so
// we reload it once here for all downstream handlers.
//
// For staff: requireAuth already sets req.user = clientUser WITH smoobuApiKey,
// so the findById call below is a no-op (userWithKey will equal req.user).
// We keep it here for safety — it's an indexed lookup, negligible overhead.
router.use(async (req, res, next) => {
  try {
    const userWithKey = await User.findById(req.user._id).select('+smoobuApiKey +properties.smoobuApiKey');
    if (userWithKey) {
      // Preserve injected properties for team_leader from requireAuth
      if (req.user.role === 'team_leader' && req.user.properties?.length) {
        userWithKey.properties = req.user.properties;
      }
      req.user = userWithKey;
    }
    next();
  } catch (err) {
    next(err);
  }
});

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
// MODE C — staff login (applied on top of A or B)
//   req.isStaff === true → further narrow the already-scoped data down
//   to only the properties listed in req.staffPropertyIds.
//   This happens AFTER MODE A / B filtering so staff never see data
//   that belongs to a different client even if propertyIds are guessed.
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
 *
 * FIX: now also computes `cancelledNights` so the Cancellations card
 * shows the correct "X nights affected" subtitle (was always 0 before).
 */
function recalcStats(filteredBookings = [], filteredProps = [], period = {}) {
  const fromDate = period.from || '';
  const toDate   = period.to   || '';

  const statsBookings = (fromDate && toDate)
    ? filteredBookings.filter((b) => {
        if (b.type === 'cancellation') {
          if (!b.arrival) return true;
          const arrival = b.arrival.slice(0, 10);
          return arrival >= fromDate && arrival <= toDate;
        }
        if (!b.arrival) return false;
        const arrival = b.arrival.slice(0, 10);
        return arrival >= fromDate && arrival <= toDate;
      })
    : filteredBookings;

  const nightCount = (b) => {
    if (!b.arrival || !b.departure) return 0;
    return Math.max(0, Math.round((new Date(b.departure) - new Date(b.arrival)) / 864e5));
  };

  let revenue = 0;
  let bookings = 0;
  let nights = 0;
  let cancellations = 0;
  let cancelledNights = 0;

  const byChannel = {};
  statsBookings.forEach((b) => {
    const bookingNights = nightCount(b);

    if (b.type === 'cancellation') {
      cancellations += 1;
      cancelledNights += bookingNights;
      return;
    }

    bookings += 1;
    nights += bookingNights;

    if (b['is-blocked-booking']) return;

    revenue += Number(b.price) || 0;

    const ch = b.channel?.name || 'Direct';
    if (!byChannel[ch]) byChannel[ch] = { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price) || 0;
    byChannel[ch].bookings += 1;
    byChannel[ch].nights   += bookingNights;
  });

  let occupancy = 0;
  if (filteredProps.length > 0 && period.from && period.to) {
    const totalDays     = Math.max(1, Math.round((new Date(period.to) - new Date(period.from)) / 864e5));
    const totalPropDays = filteredProps.length * totalDays;
    occupancy = Math.min(100, Math.round((nights / totalPropDays) * 100));
  }

  return {
    stats: {
      revenue,
      bookings,
      cancellations,
      nights,
      cancelledNights,   // FIX: included in returned stats
      occupancy,
    },
    byChannel,
  };
}

// ─────────────────────────────────────────────────────────────────
// Per-property filter (optional, applied on top of account-level
// filtering). When apartmentId is provided via query param, the
// response is scoped to only that single property's bookings, inbox
// threads, and recalculated stats.
//
// This is the mechanism used by the frontend PropertySelectorModal:
// after the user picks a property on the dashboard, every /api/dashboard
// request includes ?apartmentId=<id> so the response is already
// filtered before it reaches the client.
// ─────────────────────────────────────────────────────────────────
function applyPropertyFilter(data, apartmentId) {
  if (!apartmentId) return;

  const numId = Number(apartmentId);
  const strId = String(apartmentId);

  const selectedProp = (data.properties || []).find(
    (p) => p.id === numId || String(p.id) === strId
  );

  // If the requested apartment isn't in the user's authorised set, do nothing
  // (the data is already account-scoped upstream; this is just a narrowing filter).
  if (!selectedProp) return;

  // Narrow properties to just the selected one
  data.properties = [selectedProp];

  // Filter bookings (all bookings incl. cancelled / blocked) to this property
  data.bookings = (data.bookings || []).filter(
    (b) => b.apartment && (b.apartment.id === numId || String(b.apartment.id) === strId)
  );

  // Filter inbox threads — match by apartmentId (numeric, reliable) first,
  // then fall back to property name for threads that pre-date the apartmentId
  // field being added to the mapping.
  // FIX: The old code matched by name only. Because getInbox() fetched only
  // 5 threads, threads for the selected property were often missing entirely
  // before this filter even ran. Now that getInbox() returns up to 250 threads,
  // this filter has a full dataset to work with, and the ID match makes it
  // robust against name mismatches (trailing spaces, casing differences, etc.).
  data.inbox = (data.inbox || []).filter((t) => {
    if (t.apartmentId != null) {
      return t.apartmentId === numId || String(t.apartmentId) === strId;
    }
    // Legacy threads without apartmentId: fall back to name match
    return t.property === selectedProp.name;
  });

  // Recalculate stats & channel breakdown from the filtered booking set
  const { stats, byChannel } = recalcStats(data.bookings, data.properties, data.period);
  data.stats       = stats;
  data.byChannel   = byChannel;
  data.totalUnread = (data.inbox || []).reduce((s, t) => s + (t.unread || 0), 0);
}

// ─────────────────────────────────────────────────────────────────
// MODE C — Staff property filter
// Applied after MODE A / B so it narrows an already-client-scoped
// dataset down to only the properties the staff member is assigned to.
//
// staffPropertyIds: string[] — from req.staffPropertyIds (set by middleware).
// Smoobu property IDs are numbers; we compare both string and number forms.
// ─────────────────────────────────────────────────────────────────
function applyStaffPropertyFilter(data, staffPropertyIds, options = {}) {
  const allowedStrIds = new Set((staffPropertyIds || []).map(String));

  if (allowedStrIds.size === 0) {
    if (options.allowCurrentPropertyApiScope) {
      const scopedIds = (data.properties || [])
        .map((p) => p?.id)
        .filter((id) => id !== undefined && id !== null)
        .map(String);

      if (scopedIds.length > 0) {
        return applyStaffPropertyFilter(data, scopedIds);
      }
    }

    data.properties = [];
    data.bookings = [];
    data.inbox = [];
    const { stats, byChannel } = recalcStats(data.bookings, data.properties, data.period);
    data.stats = stats;
    data.byChannel = byChannel;
    data.totalUnread = 0;
    return;
  }

  // Filter properties to only those the staff member is assigned
  data.properties = (data.properties || []).filter(
    (p) => allowedStrIds.has(String(p.id))
  );

  const allowedNumIds = new Set([...allowedStrIds].map(Number));

  // Filter ALL bookings (including cancelled/blocked) to assigned properties
  data.bookings = (data.bookings || []).filter(
    (b) => b.apartment && (
      allowedStrIds.has(String(b.apartment.id)) ||
      allowedNumIds.has(b.apartment.id)
    )
  );

  // Filter inbox threads to assigned properties.
  // FIX: Now checks t.apartmentId (numeric, added by getInbox()) first for
  // reliable matching, then falls back to property name for backwards compat.
  const allowedPropNames = new Set((data.properties || []).map((p) => p.name));
  data.inbox = (data.inbox || []).filter((t) => {
    if (t.apartmentId != null) {
      return allowedStrIds.has(String(t.apartmentId)) || allowedNumIds.has(t.apartmentId);
    }
    // Legacy fallback: match by property name
    return allowedPropNames.has(t.property);
  });

  // Recalculate stats & channel breakdown from the narrowed booking set
  const { stats, byChannel } = recalcStats(data.bookings, data.properties, data.period);
  data.stats       = stats;
  data.byChannel   = byChannel;
  data.totalUnread = (data.inbox || []).reduce((s, t) => s + (t.unread || 0), 0);
}

// ─────────────────────────────────────────────────────────────────
// GET /api/dashboard
// ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    // ── propertyDbId — per-property Smoobu API key injection ─────────────────
    // When the user selects a specific property on the login screen, the frontend
    // stores its MongoDB _id in sessionStorage (hp_selected_property_id) and
    // passes it here as ?propertyDbId=<ObjectId string>.
    //
    // Each embedded property in user.properties[] has its own smoobuApiKey.
    // We find the matching property by _id, then inject its smoobuApiKey onto
    // the user object (as user.smoobuApiKey) so that getApiKeyForUser(user)
    // in smoobu.js picks it up via MODE A (user.smoobuApiKey is set).
    //
    // This works for all session types (regular client, clientAccount, staff)
    // because requireAuth already sets req.user = parentUser with
    // +properties.smoobuApiKey selected.
    //
    // If propertyDbId is not provided, the existing MODE A / B / C logic
    // applies unchanged (user.smoobuApiKey or env key fallback).
    let userForDashboard = req.user;
    const propertyDbId = req.query.propertyDbId;
    let usingSelectedPropertyApiKey = false;

    if (propertyDbId) {
      // ── Validate ObjectId format before touching the DB ──────────────────────
      if (!mongoose.Types.ObjectId.isValid(propertyDbId)) {
        return res.status(400).json({ error: 'Invalid property ID' });
      }

      // ── Validate ownership to prevent IDOR ───────────────────────────────────
      const matchedProp = (req.user.properties || []).find(
        (p) => String(p._id) === String(propertyDbId)
      );

      // 1. Ensure the property belongs to the business account (req.user is the client)
      if (!matchedProp) {
        return res.status(403).json({ error: 'You do not own this property' });
      }

      // 2. If the user is staff, ensure they are assigned to this property
      if (req.isStaff) {
        if (!req.staffPropertyDbIds?.includes(String(propertyDbId))) {
          return res.status(403).json({ error: 'You do not have access to this property' });
        }
      }

      if (matchedProp?.smoobuApiKey?.trim()) {
        // Spread req.user into a plain object and inject the matched property's
        // smoobuApiKey at root level so smoobu.js picks it up via MODE A.
        const baseUser = typeof req.user.toObject === 'function'
          ? req.user.toObject()
          : { ...req.user };

        userForDashboard = {
          ...baseUser,
          smoobuApiKey: matchedProp.smoobuApiKey.trim(),
        };
        usingSelectedPropertyApiKey = true;
      }
    }

    const data = await getDashboard(userForDashboard, {
      from: req.query.from,
      to:   req.query.to,
    });

    // MODE A: user has own API key → smoobu already scoped the data correctly
    if (hasOwnApiKey(userForDashboard)) {
      applyPropertyFilter(data, req.query.apartmentId);
      // MODE C: further narrow to staff's assigned properties if applicable
      if (req.isStaff) {
        applyStaffPropertyFilter(data, req.staffPropertyIds, {
          allowCurrentPropertyApiScope: usingSelectedPropertyApiKey,
        });
      }
      return res.json(data);
    }

    // MODE B: shared key → apply propertyTagPrefix filter
    const prefix = (userForDashboard.propertyTagPrefix || '').trim();
    if (prefix) {
      const { props, propIds } = filterPropsByPrefix(data.properties || [], prefix);

      const filteredBookings = (data.bookings || []).filter(
        (b) => b.apartment && propIds.has(b.apartment.id)
      );
      // FIX: threads no longer have a t.apartment object — getInbox() maps
      // apartment data to t.apartmentId (number) and t.property (name).
      // The old filter `t.apartment && propIds.has(t.apartment.id)` always
      // returned false (t.apartment is undefined), so inbox was always empty
      // in MODE B. Now we check t.apartmentId first, then fall back to name.
      const filteredInbox = (data.inbox || []).filter((t) => {
        if (t.apartmentId != null) return propIds.has(t.apartmentId);
        // Legacy fallback: match by property name
        return (data.properties || []).some((p) => p.name === t.property);
      });

      const { stats, byChannel } = recalcStats(filteredBookings, props, data.period);

      data.properties  = props;
      data.bookings    = filteredBookings;
      data.inbox       = filteredInbox;
      data.stats       = stats;
      data.byChannel   = byChannel;
      data.totalUnread = filteredInbox.reduce((s, t) => s + (t.unread || 0), 0);
    }

    applyPropertyFilter(data, req.query.apartmentId);
    // MODE C: further narrow to staff's assigned properties if applicable
    if (req.isStaff) applyStaffPropertyFilter(data, req.staffPropertyIds);
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
        stats: {
          revenue:         0,
          bookings:        0,
          cancellations:   0,
          nights:          0,
          cancelledNights: 0,
          occupancy:       0,
        },
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

    // MODE C: staff only sees their assigned properties
    if (req.isStaff) {
      const allowedStrIds = new Set((req.staffPropertyIds || []).map(String));
      data.apartments = (data.apartments || []).filter(
        (p) => allowedStrIds.has(String(p.id))
      );
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

    // MODE C: staff only sees bookings for their assigned properties
    if (req.isStaff) {
      const allowedStrIds = new Set((req.staffPropertyIds || []).map(String));
      const allowedNumIds = new Set([...allowedStrIds].map(Number));
      data.bookings = (data.bookings || []).filter(
        (b) => b.apartment && (
          allowedStrIds.has(String(b.apartment.id)) ||
          allowedNumIds.has(b.apartment.id)
        )
      );
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

    // MODE C: staff can only request rates for their assigned properties
    if (req.isStaff) {
      const allowedStrIds = new Set((req.staffPropertyIds || []).map(String));
      requestedIds = requestedIds.filter((id) => allowedStrIds.has(String(id)));
      if (!requestedIds.length) {
        return res.status(403).json({ error: 'None of the requested apartments are assigned to you' });
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
// In MODE C (staff): verify the reservation's apartment is in staffPropertyIds.
// ─────────────────────────────────────────────────────────────────
async function assertReservationOwnership(req, reservationId) {
  const user = req.user;

  // Wide date window — getBookings() with no from/to defaults to Smoobu's
  // narrow current-month window, missing past/future reservations → 404.
  // Fetch ±2 years to reliably find any reservation (matches smoobu.js's
  // verifyReservationOwnership which already uses the same approach).
  const fmt = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  const wideFrom = fmt(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()));
  const wideTo   = fmt(new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()));

  // MODE C: staff ownership check — must be one of their assigned properties
  if (req.isStaff) {
    if (!req.staffPropertyIds?.length) {
      const err = new Error('No properties assigned to this staff account'); err.status = 403; throw err;
    }
    const allowedStrIds = new Set(req.staffPropertyIds.map(String));
    const allowedNumIds = new Set([...allowedStrIds].map(Number));

    const { bookings = [] } = await getBookings(user, { from: wideFrom, to: wideTo });
    const reservation = bookings.find((b) => String(b.id) === String(reservationId));

    if (!reservation) {
      const err = new Error('Reservation not found'); err.status = 404; throw err;
    }
    if (
      !allowedStrIds.has(String(reservation.apartment?.id)) &&
      !allowedNumIds.has(reservation.apartment?.id)
    ) {
      const err = new Error('Unauthorized: reservation does not belong to your assigned properties');
      err.status = 403; throw err;
    }
    return;
  }

  // MODE A: API key already scopes access
  if (hasOwnApiKey(user)) return;

  // MODE B: verify the reservation's apartment is in the user's prefix set
  const prefix = (user.propertyTagPrefix || '').trim();
  if (!prefix) return; // admin / no prefix = no restriction

  const allProps   = await getApartments(user);
  const { propIds } = filterPropsByPrefix(allProps.apartments || [], prefix);

  const { bookings = [] } = await getBookings(user, { from: wideFrom, to: wideTo });
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
    // ── Staff-only guard ───────────────────────────────────────────────
    // Only staff accounts may reply to guest messages. Team leaders and
    // clients (and any other non-staff role) are read-only for messaging.
    // req.isStaff is set by requireAuth based on the JWT `role` claim, so
    // this cannot be bypassed from the frontend.
    if (!req.isStaff) {
      return res.status(403).json({ error: 'Only staff accounts can reply to messages' });
    }

    const { reservationId, subject, messageBody } = req.body;
    if (!reservationId || !messageBody) {
      return res.status(400).json({ error: 'reservationId and messageBody are required' });
    }

    await assertReservationOwnership(req, reservationId);

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
    await assertReservationOwnership(req, req.params.reservationId);

    const data = await getReservationMessages(req.user, req.params.reservationId);

    // Surface whether the current account may reply, using the SAME basis the
    // POST /messages/reply guard enforces (req.isStaff). The frontend uses this
    // to show/hide the reply composer authoritatively instead of guessing from
    // the JWT — so staff always get the composer, team leaders/clients don't.
    const isStaff = !!req.isStaff;
    if (Array.isArray(data)) {
      res.json({ messages: data, isStaff });
    } else {
      res.json({ ...data, isStaff });
    }
  } catch (err) {
    if (err.status === 403 || err.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.status === 404 || err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    // Pass Smoobu error status through so the frontend gets a meaningful code
    // (e.g. 502 for non-JSON body, 422 for unprocessable) instead of always 500.
    if (err.status && err.status >= 400) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/debug/threads
// Hits Smoobu's /threads endpoint directly and returns the raw response
// so we can see what Smoobu is actually returning (keys, count, errors).
// Remove this endpoint after debugging is complete.
// ─────────────────────────────────────────────────────────────────
router.get('/debug/threads', async (req, res, next) => {
  try {
    const { getApiKeyForUser } = await import('../services/smoobu.js');
    const apiKey = getApiKeyForUser(req.user);
    const smoobuRes = await fetch('https://login.smoobu.com/api/threads?page=1&pageSize=10', {
      headers: { 'Api-Key': apiKey, 'Cache-Control': 'no-cache' },
    });
    const text = await smoobuRes.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    res.json({
      status:       smoobuRes.status,
      statusText:   smoobuRes.statusText,
      responseKeys: parsed ? Object.keys(parsed) : null,
      threadsCount: parsed?.threads?.length ?? null,
      pageCount:    parsed?.page_count ?? null,
      rawPreview:   text.slice(0, 500),
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/exchange-rate
// Proxies the exchange rate API to avoid exposing the external URL to the frontend
// and avoids CSP/CORS issues.
// ─────────────────────────────────────────────────────────────────
router.get('/exchange-rate', async (req, res, next) => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch exchange rates' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
