// src/services/smoobu.js
//
// Simple per-user Smoobu integration.
// Bawat user ay may sariling Smoobu API key na naka-store sa kanilang account.
// Yung key lang nila ang ginagamit — hindi sila makakakita ng data ng iba.
//
// Two modes:
//   MODE A — user.smoobuApiKey is set → use it directly, fully scoped.
//   MODE B — user.smoobuApiKey is null → fall back to process.env.SMOOBU_API_KEY
//            (shared key). routes/dashboard.js then applies propertyTagPrefix
//            filtering so each user only sees their own subset.

import { isEncrypted } from '../utils/encryption.js';

const BASE = 'https://login.smoobu.com/api';
const cache = new Map();

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  return hit.data;
}

function setCache(key, data, ttlMs = 60_000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ─────────────────────────────────────────────────────────────────
// CORE FETCH
// Cache key is scoped per user (_id) so users never share cached data.
// ─────────────────────────────────────────────────────────────────
async function smoobuRequest(path, apiKey, userId) {
  const cacheKey = `${userId}:${path}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const res = await fetch(BASE + path, {
    headers: {
      'Api-Key': apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  const text = await res.text();

  if (!res.ok) {
    const err = new Error(`Smoobu ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.warn(`[smoobu] non-JSON response for ${path} (status ${res.status}):`, text.slice(0, 200));
    const err = new Error(`Smoobu returned non-JSON for ${path}`);
    err.status = 502;
    throw err;
  }

  setCache(cacheKey, data);
  return data;
}

// ─────────────────────────────────────────────────────────────────
// PAGINATED FETCH
// ─────────────────────────────────────────────────────────────────
async function smoobuRequestAllPages(basePath, apiKey, userId, { showCancellation = true } = {}) {
  const allBookings = [];
  let page = 1;
  let totalPages = 1;
  const PAGE_SIZE = 100;

  do {
    const sep = basePath.includes('?') ? '&' : '?';
    const path = `${basePath}${sep}page=${page}&pageSize=${PAGE_SIZE}${showCancellation ? '&showCancellation=1' : ''}`;
    const data = await smoobuRequest(path, apiKey, userId);

    if (data.bookings && Array.isArray(data.bookings)) {
      allBookings.push(...data.bookings);
    }

    totalPages = data.page_count || 1;
    page++;

    if (page > 50) {
      console.warn('Smoobu pagination exceeded 50 pages, stopping');
      break;
    }
  } while (page <= totalPages);

  return { bookings: allBookings, total: allBookings.length };
}

// ─────────────────────────────────────────────────────────────────
// GET API KEY
// ─────────────────────────────────────────────────────────────────
export function getApiKeyForUser(user) {
  // Root-level key (MODE A — per-user Smoobu account)
  if (user.smoobuApiKey && user.smoobuApiKey.trim()) {
    return user.smoobuApiKey.trim();
  }

  // Shared env key (MODE B — legacy shared account)
  const envKey = process.env.SMOOBU_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // Per-property key fallback: keys stored on user.properties[].smoobuApiKey.
  // The dashboard route injects the selected property's key at root level before
  // calling smoobu functions, but other routes (messages, etc.) may not have a
  // propertyDbId context — fall back to the first property key found.
  // decrypt() returns ciphertext (not null) on failure, so we must also check
  // isEncrypted() to skip keys that failed to decrypt — otherwise ciphertext
  // gets sent to Smoobu as the API key, which returns 401.
  for (const p of user.properties || []) {
    try {
      const k = p.smoobuApiKey?.trim();
      if (k && !isEncrypted(k)) return k;
    } catch { /* corrupted/undecryptable key — skip this property */ }
  }

  const err = new Error('No Smoobu API key connected. Please connect your Smoobu account.');
  err.code = 'NO_SMOOBU_KEY';
  throw err;
}

function getCacheUserId(user) {
  // Include a fingerprint of the active smoobuApiKey in the cache key so that
  // switching properties (which changes the API key) busts the cache immediately.
  // Without this, the old property's cached data is returned even after switching.
  let keyHint;
  if (user.smoobuApiKey?.trim()) {
    keyHint = user.smoobuApiKey.trim().slice(-8);
  } else if (process.env.SMOOBU_API_KEY?.trim()) {
    keyHint = 'env';
  } else {
    let propKey = null;
    for (const p of user.properties || []) {
      try { const k = p.smoobuApiKey?.trim(); if (k && !isEncrypted(k)) { propKey = k; break; } } catch { /* skip */ }
    }
    keyHint = propKey ? propKey.slice(-8) : 'none';
  }
  return `${String(user._id)}:${keyHint}`;
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

export async function getApartments(user) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);
  const data = await smoobuRequest('/apartments', apiKey, userId);
  return { apartments: data.apartments || [] };
}

// ─────────────────────────────────────────────────────────────────
// GET SINGLE APARTMENT DETAIL  (GET /apartments/{id})
// Returns location (street/zip/city/country/lat/lng), rooms, price,
// currency, equipments and type for one apartment. Cached like the rest.
// ─────────────────────────────────────────────────────────────────
export async function getApartmentDetail(user, apartmentId) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);
  const data = await smoobuRequest(`/apartments/${apartmentId}`, apiKey, userId);
  return data;
}

// ─────────────────────────────────────────────────────────────────
// GET APARTMENT PICTURES  (GET /apartments/{id}/pictures)
//
// Smoobu stores images on a SEPARATE endpoint — they do NOT appear on
// GET /apartments or GET /apartments/{id}.  This function tries every
// known Smoobu image sub-path so we find them regardless of API version:
//   /apartments/{id}/pictures   ← primary (confirmed in Smoobu docs v2)
//   /apartments/{id}/photos     ← older API versions
//   /apartments/{id}/images     ← some white-label builds
//
// Returns a normalised array: [{ id, url }, ...]
// Returns [] on any error so callers never break.
// Full raw response is logged on the first apartment so you can see the
// exact field names Smoobu uses for YOUR account.
// ─────────────────────────────────────────────────────────────────
export async function getApartmentPictures(user, apartmentId) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const paths = [
    `/apartments/${apartmentId}/pictures`,
    `/apartments/${apartmentId}/photos`,
    `/apartments/${apartmentId}/images`,
  ];

  for (const path of paths) {
    try {
      const data = await smoobuRequest(path, apiKey, userId);

      // Diagnostic: log the full raw shape so we know what Smoobu actually sends
      console.log(`[smoobu] getApartmentPictures apt=${apartmentId} path=${path} → keys:`, Object.keys(data || {}));
      const arrayKeys = Object.keys(data || {}).filter((k) => Array.isArray(data[k]));
      console.log(`[smoobu] getApartmentPictures apt=${apartmentId} array-keys:`, arrayKeys);
      if (arrayKeys.length > 0) {
        arrayKeys.forEach((k) => {
          console.log(`[smoobu]   data.${k}[0]:`, JSON.stringify((data[k] || [])[0]).slice(0, 200));
        });
      }

      // Extract from every known shape
      const raw =
        Array.isArray(data)           ? data              // bare array
      : Array.isArray(data?.pictures) ? data.pictures
      : Array.isArray(data?.photos)   ? data.photos
      : Array.isArray(data?.images)   ? data.images
      : Array.isArray(data?.media)    ? data.media
      : Array.isArray(data?.gallery)  ? data.gallery
      : Array.isArray(data?.data)     ? data.data         // paginated wrapper
      : [];

      if (raw.length === 0) {
        console.log(`[smoobu] getApartmentPictures apt=${apartmentId} path=${path} → empty, trying next`);
        continue;
      }

      const normalised = raw
        .filter((img) => img != null)
        .map((img) => {
          if (typeof img === 'string' && img.trim())
            return { id: null, url: img.trim() };
          if (img && typeof img.url === 'string' && img.url.trim())
            return { id: img.id ?? null, url: img.url.trim() };
          if (img && typeof img.image === 'string' && img.image.trim())
            return { id: img.id ?? null, url: img.image.trim() };
          if (img && typeof img.src === 'string' && img.src.trim())
            return { id: img.id ?? null, url: img.src.trim() };
          if (img && typeof img.link === 'string' && img.link.trim())
            return { id: img.id ?? null, url: img.link.trim() };
          if (img && typeof img.picture === 'string' && img.picture.trim())
            return { id: img.id ?? null, url: img.picture.trim() };
          return null;
        })
        .filter(Boolean);

      console.log(`[smoobu] getApartmentPictures apt=${apartmentId} → found ${normalised.length} images via ${path}`);
      return normalised;
    } catch (err) {
      // 404 = endpoint doesn't exist for this Smoobu account; try next path
      if (err.status === 404 || err.status === 405) {
        console.log(`[smoobu] getApartmentPictures apt=${apartmentId} path=${path} → ${err.status}, trying next`);
        continue;
      }
      // Any other error (401, 500, network) — bail out entirely, don't spam
      console.warn(`[smoobu] getApartmentPictures apt=${apartmentId} path=${path} → error:`, err.message);
      return [];
    }
  }

  console.log(`[smoobu] getApartmentPictures apt=${apartmentId} → all paths exhausted, returning []`);
  return [];
}

export async function getBookings(user, { from, to, apartmentId, showCancellation = true } = {}) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to)   params.append('to', to);
  if (apartmentId) params.append('apartmentId', apartmentId);

  const basePath = `/reservations?${params.toString()}`;
  const { bookings } = await smoobuRequestAllPages(basePath, apiKey, userId, { showCancellation });

  return { bookings, total: bookings.length };
}

export async function getRates(user, { apartmentIds, start, end }) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const idsParam = apartmentIds.map(id => `apartments[]=${id}`).join('&');
  return smoobuRequest(
    `/rates?${idsParam}&start_date=${start}&end_date=${end}`,
    apiKey,
    userId
  );
}

// ─────────────────────────────────────────────────────────────────
// INBOX
//
// FIX: Smoobu's /threads endpoint only returns reservations that have
// at least one message. Reservations with NO messages are never listed
// there — so guests who haven't messaged yet were invisible in the inbox.
//
// Solution: fetch BOTH sources in parallel and merge them:
//   1. /threads            → reservations with existing messages
//   2. /reservations (recent window) → ALL confirmed bookings
//
// Bookings that already have a thread are skipped (de-duped by reservationId).
// Bookings with no thread get a synthetic "No messages yet" entry so they
// always appear in the inbox and can be messaged first.
// ─────────────────────────────────────────────────────────────────
export async function getInbox(user, { limit = 250 } = {}) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  // ── 1. Fetch /threads (reservations with existing messages) ────────────────
  const allThreads = [];
  let page = 1;
  const PAGE_SIZE = 50;

  try {
    // FIX: Raised max page cap from 5 to 20 (20 × 50 = 1,000 threads max).
    // The old cap of 5 pages (250 threads) was also fine for most accounts,
    // but the real problem was limit=5 at the end that threw away 245 threads
    // before the property filter could run. Now we keep up to `limit` threads
    // (default 250) so the caller always has the full set to filter from.
    while (page <= 20) {
      const data = await smoobuRequest(
        `/threads?page=${page}&pageSize=${PAGE_SIZE}`,
        apiKey,
        userId
      );
      if (page === 1) {
        console.log('[smoobu] /threads response keys:', Object.keys(data || {}), '| threads:', (data.threads || []).length, '| page_count:', data.page_count);
      }
      const threads = data.threads || [];
      allThreads.push(...threads);

      const totalPages = data.page_count || 1;
      if (page >= totalPages) break;
      page++;
    }
  } catch (e) {
    console.warn('Threads fetch failed:', e.message);
    // Don't bail out entirely — fall through and still build inbox from bookings
  }

  // ── 2. Fetch recent confirmed bookings (±1 year window) ────────────────────
  // This is what surfaces guests who haven't messaged yet.
  const today = new Date();
  const oneYearAgo   = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearAhead = new Date(today); oneYearAhead.setFullYear(today.getFullYear() + 1);
  const fmt = d => d.toISOString().slice(0, 10);

  let allBookingsForInbox = [];
  try {
    const { bookings } = await smoobuRequestAllPages(
      `/reservations?from=${fmt(oneYearAgo)}&to=${fmt(oneYearAhead)}`,
      apiKey,
      userId,
      { showCancellation: false } // only confirmed; cancelled guests can't be messaged
    );
    allBookingsForInbox = bookings;
  } catch (e) {
    console.warn('Bookings fetch for inbox merge failed:', e.message);
  }

  // ── 3. Build a Set of reservationIds that already have a thread ────────────
  const threadedIds = new Set(
    allThreads
      .map(t => t.booking?.id)
      .filter(Boolean)
      .map(String)
  );

  // ── 4. Map /threads to the normalised shape ────────────────────────────────
  const totalUnread = allThreads.reduce((sum, t) => sum + (t.unread_messages || 0), 0);

  const threadItems = allThreads.map(t => {
    const msg = t.latest_message || {};
    return {
      reservationId: t.booking?.id,
      guestName:     t.booking?.guest_name || 'Guest',
      // FIX: expose apartmentId (numeric) alongside property name so
      // applyPropertyFilter in dashboard.js can match by ID (reliable)
      // instead of relying solely on name matching (fragile if names differ
      // by whitespace, casing, or have duplicates across Smoobu accounts).
      apartmentId:   t.apartment?.id ?? null,
      property:      t.apartment?.name || '',
      channel:       t.channel?.name || t.booking?.channel?.name || 'Direct',
      arrival:       t.booking?.arrival   ? String(t.booking.arrival).slice(0, 10)   : null,
      departure:     t.booking?.departure ? String(t.booking.departure).slice(0, 10) : null,
      latestMessage: {
        body:      msg.text_content || msg.html_content || '',
        subject:   msg.subject || '',
        createdAt: msg.created_at || null,
        fromGuest: msg.type === 1 || msg.direction === 'incoming',
      },
      unread:      t.unread_messages || 0,
      bookingType: t.booking?.type || null,
      hasThread:   true,
    };
  });

  // ── 5. Build synthetic entries for bookings with NO thread ─────────────────
  // These are confirmed guests who haven't messaged yet (or whose thread
  // wasn't returned by /threads — e.g. very old threads or API limitations).
  const bookingOnlyItems = allBookingsForInbox
    .filter(b =>
      !b['is-blocked-booking'] &&
      b.type !== 'cancellation' &&
      b['guest-name'] &&
      !threadedIds.has(String(b.id))
    )
    .map(b => ({
      reservationId: b.id,
      guestName:     b['guest-name'] || 'Guest',
      apartmentId:   b.apartment?.id ?? null,
      property:      b.apartment?.name || '',
      channel:       b.channel?.name || 'Direct',
      arrival:       b.arrival   ? String(b.arrival).slice(0, 10)   : null,
      departure:     b.departure ? String(b.departure).slice(0, 10) : null,
      latestMessage: {
        body:      '',          // no messages yet
        subject:   '',
        createdAt: b['created-at'] || b.arrival || null,
        fromGuest: false,       // no message from guest — show as "no reply needed"
      },
      unread:      0,
      bookingType: b.type || null,
      hasThread:   false,       // UI can use this to show "No messages yet" badge
    }));

  // ── 6. Merge, sort newest-first, cap at limit ──────────────────────────────
  // Sort key: for threaded items use the latest message date;
  //           for booking-only items use the booking arrival date.
  const merged = [...threadItems, ...bookingOnlyItems]
    .sort((a, b) => {
      const aDate = a.latestMessage?.createdAt || a.arrival || '';
      const bDate = b.latestMessage?.createdAt || b.arrival || '';
      return new Date(bDate || 0) - new Date(aDate || 0);
    })
    .slice(0, limit);

  return {
    threads:      merged,
    totalUnread,
    totalThreads: merged.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────
export async function getDashboard(user, { from, to } = {}) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = d => d.toISOString().slice(0, 10);

  const fromDate = from || fmt(startOfMonth);
  const toDate   = to   || fmt(today);

  // FIX 1: Fetch a wide window to capture ALL bookings including cancellations.
  // Smoobu's /reservations API filters by arrival date when using from/to params.
  // Cancellations often have their ORIGINAL arrival date — if a guest booked for
  // next year and cancelled, the cancellation record has next year's arrival date.
  // We must fetch far enough ahead to capture those.
  // Also fetch 2 years back so we catch cancellations for past bookings that were
  // created within the user's selected period.
  const fetchFrom = new Date(fromDate);
  fetchFrom.setFullYear(fetchFrom.getFullYear() - 1); // 1 year before selected start
  const fetchTo = new Date(toDate);
  fetchTo.setFullYear(fetchTo.getFullYear() + 2);     // 2 years after selected end

  const [apartmentsData, bookingsData] = await Promise.all([
    getApartments(user),
    getBookings(user, { from: fmt(fetchFrom), to: fmt(fetchTo), showCancellation: true }),
  ]);

  const properties  = apartmentsData.apartments || [];
  const allBookings = bookingsData.bookings     || [];

  // FIX 2: computeNights must return 0 (not 1) when dates are missing.
  // The old Math.max(1, ...) was giving every no-date cancellation 1 phantom night,
  // inflating cancelledNights.
  function computeNights(b) {
    if (!b.arrival || !b.departure) return 0;
    const nights = Math.round((new Date(b.departure) - new Date(b.arrival)) / (1000 * 60 * 60 * 24));
    return Math.max(0, nights);
  }

  // FIX 3: Correct booking-to-stats-period matching.
  //
  // Smoobu Analytics counts a booking/cancellation in a period if its
  // ARRIVAL DATE falls within that period (not a departure-overlap check).
  // Using arrival-overlap (arrival <= toDate AND departure > fromDate) was
  // pulling in bookings from outside the period and missing others.
  //
  // Exception: cancellations with NO arrival date are still counted if they
  // exist in the API response for this query window — Smoobu sometimes strips
  // dates from cancelled records.
  const statsBookings = allBookings.filter(b => {
    if (b.type === 'cancellation') {
      // No arrival date: include it — it was returned by Smoobu so it's relevant
      if (!b.arrival) return true;
      // Has arrival: only include if arrival is within our selected period
      const arrival = b.arrival.slice(0, 10);
      return arrival >= fromDate && arrival <= toDate;
    }
    // Regular + blocked bookings: must have arrival, and arrival must be in period
    if (!b.arrival) return false;
    const arrival = b.arrival.slice(0, 10);
    return arrival >= fromDate && arrival <= toDate;
  });

  let totalRevenue = 0, totalNights = 0, totalBookings = 0;
  let cancellations = 0, cancelledNights = 0;
  const byChannel = {};

  statsBookings.forEach(b => {
    const nights = computeNights(b);

    if (b.type === 'cancellation') {
      cancellations++;
      cancelledNights += nights;
      return;
    }

    // FIX 4: Blocked bookings — Smoobu Analytics DOES include them in the
    // bookings count (that's why Smoobu shows 149 while we showed 141 —
    // we were skipping blocked bookings entirely).
    // Include them in totalBookings but NOT in revenue or channel breakdown
    // (blocked bookings have no price or channel).
    if (b['is-blocked-booking']) {
      totalBookings += 1;
      totalNights   += nights; // blocked nights DO reduce availability
      return;
    }

    totalRevenue  += Number(b.price) || 0;
    totalNights   += nights;
    totalBookings += 1;

    const ch = b.channel?.name || 'Direct';
    byChannel[ch] = byChannel[ch] || { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price) || 0;
    byChannel[ch].bookings += 1;
    byChannel[ch].nights   += nights;
  });

  // FIX 5: Occupancy denominator must match Smoobu's calculation.
  // Smoobu uses: booked nights / (number_of_properties × days_in_selected_range).
  // The old code used daysInRange + 1 which over-counted by 1 day.
  // Also, the old code added +1 to make it inclusive — Smoobu uses exclusive end
  // (from Jan 1 to Dec 31 = 364 days, not 365). Match Smoobu exactly:
  const daysInRange = Math.max(
    1,
    Math.round((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24))
  );
  const totalAvailableNights = daysInRange * (properties.length || 1);
  const occupancyPct = Math.min(100, Math.round((totalNights / totalAvailableNights) * 100));

  // FIX 6: revenueChart should only use confirmed (non-cancelled, non-blocked)
  // bookings, grouped by arrival month, matching how Smoobu shows it.
  const revenueByMonth = {};
  statsBookings.forEach(b => {
    if (b.type === 'cancellation' || b['is-blocked-booking']) return;
    if (!b.arrival) return;
    const month = b.arrival.slice(0, 7); // YYYY-MM
    revenueByMonth[month] = (revenueByMonth[month] || 0) + (Number(b.price) || 0);
  });

  const revenueChart = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));

  // FIX: limit raised to 250 so applyPropertyFilter in dashboard.js has the
  // full thread set to filter from. With limit=5, selecting a property that
  // wasn't in the top-5 most-recent threads returned 0 inbox items even when
  // that property had many messages.
  const inboxData = await getInbox(user, { limit: 250 }).catch(err => {
    console.warn('Inbox fetch failed:', err.message);
    return { threads: [], totalUnread: 0, totalThreads: 0 };
  });

  return {
    period: { from: fromDate, to: toDate, days: daysInRange },
    stats: {
      revenue:        totalRevenue,
      bookings:       totalBookings,
      cancellations,
      cancelledNights,
      nights:         totalNights,
      occupancy:      occupancyPct,
    },
    byChannel,
    revenueChart,
    properties,
    bookings:     allBookings,
    inbox:        inboxData.threads,
    totalUnread:  inboxData.totalUnread,
    totalThreads: inboxData.totalThreads,
  };
}

// ─────────────────────────────────────────────────────────────────
// MESSAGING
// ─────────────────────────────────────────────────────────────────
async function verifyReservationOwnership(user, reservationId) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const today = new Date();
  const twoYearsAgo   = new Date(); twoYearsAgo.setFullYear(today.getFullYear() - 2);
  const twoYearsAhead = new Date(); twoYearsAhead.setFullYear(today.getFullYear() + 2);
  const fmt = d => d.toISOString().slice(0, 10);

  const { bookings } = await smoobuRequestAllPages(
    `/reservations?from=${fmt(twoYearsAgo)}&to=${fmt(twoYearsAhead)}`,
    apiKey,
    userId,
    { showCancellation: true }
  );

  const reservation = bookings.find(b => String(b.id) === String(reservationId));
  if (!reservation) {
    const err = new Error('Reservation not found'); err.status = 404; throw err;
  }
  return reservation;
}

export async function getReservationMessages(user, reservationId) {
  await verifyReservationOwnership(user, reservationId);
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);
  try {
    return smoobuRequest(`/reservations/${reservationId}/messages`, apiKey, userId);
  } catch (err) {
    // 404 means no message thread exists yet for this reservation — return empty.
    // All other errors (500, 502, auth errors) are real failures and should surface.
    if (err.status === 404) return { messages: [] };
    console.warn(`[smoobu] messages for reservation ${reservationId} failed (${err.status}): ${err.message}`);
    throw err;
  }
}

export async function sendReplyToGuest(user, reservationId, { subject, messageBody }) {
  await verifyReservationOwnership(user, reservationId);
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const res = await fetch(
    `${BASE}/reservations/${reservationId}/messages/send-message-to-guest`,
    {
      method: 'POST',
      headers: {
        'Api-Key':        apiKey,
        'Content-Type':   'application/json',
        'Cache-Control':  'no-cache',
      },
      body: JSON.stringify({
        subject:     subject || 'Re: Your message',
        messageBody: messageBody,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Smoobu send failed ${res.status}: ${text}`);
  }

  // Invalidate message and thread cache for this user
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`) && (key.includes('/messages') || key.includes('/threads'))) {
      cache.delete(key);
    }
  }

  return res.json();
}