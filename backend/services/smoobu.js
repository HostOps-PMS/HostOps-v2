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
//
// MODE A: user has their own smoobuApiKey → use it. Smoobu already
//         scopes all responses to that account.
//
// MODE B: user has no personal key → fall back to the shared
//         process.env.SMOOBU_API_KEY. routes/dashboard.js is
//         responsible for applying propertyTagPrefix filtering
//         afterwards so users only see their own properties.
//
// Throws NO_SMOOBU_KEY only when NEITHER source has a key — meaning
// the server is misconfigured or the user genuinely hasn't connected.
//
// WHY the env fallback lives here:
//   Previously getApiKeyForUser threw immediately for any user without
//   a personal key, so MODE B could never work — getDashboard() would
//   throw before routes/dashboard.js could do prefix filtering.
// ─────────────────────────────────────────────────────────────────
export function getApiKeyForUser(user) {
  // MODE A — personal key takes priority
  if (user.smoobuApiKey && user.smoobuApiKey.trim()) {
    return user.smoobuApiKey.trim();
  }

  // MODE B — shared env key fallback
  const envKey = process.env.SMOOBU_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // Neither source configured — user must connect their Smoobu account
  const err = new Error('No Smoobu API key connected. Please connect your Smoobu account.');
  err.code = 'NO_SMOOBU_KEY';
  throw err;
}

// ─────────────────────────────────────────────────────────────────
// CACHE USER ID HELPER
//
// In MODE B all users share the same API key and therefore the same
// Smoobu account. To prevent their cache slots from colliding we
// suffix the cache key with the user's _id, just like MODE A.
// The shared-key data is fetched once per user per TTL window, and
// routes/dashboard.js trims it down to their prefix subset before
// sending to the client.
// ─────────────────────────────────────────────────────────────────
function getCacheUserId(user) {
  return String(user._id);
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
export async function getInbox(user, { limit = 5 } = {}) {
  const apiKey = getApiKeyForUser(user);
  const userId = getCacheUserId(user);

  const allThreads = [];
  let page = 1;
  const PAGE_SIZE = 50;

  try {
    while (page <= 5) {
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

  const fetchToDate = new Date();
  fetchToDate.setFullYear(fetchToDate.getFullYear() + 2);
  const fetchToDateStr = fmt(new Date(Math.max(new Date(toDate), fetchToDate)));

  const [apartmentsData, bookingsData] = await Promise.all([
    getApartments(user),
    getBookings(user, { from: fromDate, to: fetchToDateStr, showCancellation: true }),
  ]);

  const properties  = apartmentsData.apartments || [];
  const allBookings = bookingsData.bookings     || [];

  // Filter bookings to stats period
  const statsBookings = allBookings.filter(b => {
    if (!b.arrival || !b.departure) return false;
    return b.arrival.slice(0, 10) <= toDate && b.departure.slice(0, 10) > fromDate;
  });

  function computeNights(b) {
    if (!b.arrival || !b.departure) return 0;
    return Math.max(1, Math.round((new Date(b.departure) - new Date(b.arrival)) / (1000 * 60 * 60 * 24)));
  }

  let totalRevenue = 0, totalNights = 0, totalBookings = 0, cancellations = 0, cancellationNights = 0;
  const byChannel = {};

  statsBookings.forEach(b => {
    const nights = computeNights(b);
    if (b.type === 'cancellation') {
      cancellations++;
      cancellationNights += nights;
      return;
    }
    if (b['is-blocked-booking']) return;

    totalRevenue  += Number(b.price) || 0;
    totalNights   += nights;
    totalBookings += 1;

    const ch = b.channel?.name || 'Direct';
    byChannel[ch] = byChannel[ch] || { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price) || 0;
    byChannel[ch].bookings += 1;
    byChannel[ch].nights   += nights;
  });

  const daysInRange = Math.max(1, Math.round(
    (new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)
  )) + 1;
  const totalAvailableNights = daysInRange * (properties.length || 1);
  const occupancyPct = Math.min(100, Math.round((totalNights / totalAvailableNights) * 100));

  const inboxData = await getInbox(user, { limit: 5 }).catch(err => {
    console.warn('Inbox fetch failed:', err.message);
    return { threads: [], totalUnread: 0, totalThreads: 0 };
  });

  return {
    period: { from: fromDate, to: toDate, days: daysInRange },
    stats: {
      revenue: totalRevenue,
      bookings: totalBookings,
      cancellations,
      cancellationNights,
      nights: totalNights,
      occupancy: occupancyPct,
    },
    byChannel,
    properties,
    bookings: allBookings,
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