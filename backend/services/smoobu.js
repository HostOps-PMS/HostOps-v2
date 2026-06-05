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

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Smoobu ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
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
  if (user.smoobuApiKey && user.smoobuApiKey.trim()) {
    return user.smoobuApiKey.trim();
  }

  const envKey = process.env.SMOOBU_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  const err = new Error('No Smoobu API key connected. Please connect your Smoobu account.');
  err.code = 'NO_SMOOBU_KEY';
  throw err;
}

function getCacheUserId(user) {
  // Include a fingerprint of the active smoobuApiKey in the cache key so that
  // switching properties (which changes the API key) busts the cache immediately.
  // Without this, the old property's cached data is returned even after switching.
  const keyHint = user.smoobuApiKey
    ? user.smoobuApiKey.trim().slice(-8)   // last 8 chars — enough to differentiate
    : 'env';
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
// ─────────────────────────────────────────────────────────────────
export async function getInbox(user, { limit = 250 } = {}) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

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
      const threads = data.threads || [];
      allThreads.push(...threads);

      const totalPages = data.page_count || 1;
      if (page >= totalPages) break;
      page++;
    }
  } catch (e) {
    console.warn('Threads fetch failed:', e.message);
    return { threads: [], totalUnread: 0 };
  }

  const sorted = allThreads
    .sort((a, b) => {
      const aDate = a.latest_message?.created_at;
      const bDate = b.latest_message?.created_at;
      return new Date(bDate || 0) - new Date(aDate || 0);
    })
    .slice(0, limit);

  const totalUnread = allThreads.reduce((sum, t) => sum + (t.unread_messages || 0), 0);

  return {
    threads: sorted.map(t => {
      const msg = t.latest_message || {};
      return {
        reservationId: t.booking?.id,
        guestName:     (t.booking?.guest_name) || 'Guest',
        // FIX: expose apartmentId (numeric) alongside property name so
        // applyPropertyFilter in dashboard.js can match by ID (reliable)
        // instead of relying solely on name matching (fragile if names differ
        // by whitespace, casing, or have duplicates across Smoobu accounts).
        apartmentId:   t.apartment?.id ?? null,
        property:      t.apartment?.name || '',
        channel:       t.channel?.name || t.booking?.channel?.name || 'Direct',
        latestMessage: {
          body:        msg.text_content || msg.html_content || '',
          subject:     msg.subject || '',
          createdAt:   msg.created_at || null,
          fromGuest:   msg.type === 1 || msg.direction === 'incoming',
        },
        unread:      t.unread_messages || 0,
        bookingType: t.booking?.type || null,
      };
    }),
    totalUnread,
    totalThreads: allThreads.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────
export async function getDashboard(user, { from, to } = {}) {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const fmt = d => d.toISOString().slice(0, 10);

  const fromDate = from || fmt(startOfYear);
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
  return smoobuRequest(`/reservations/${reservationId}/messages`, apiKey, userId);
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