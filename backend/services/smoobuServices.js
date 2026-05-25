/**
 * smoobuService.js
 *
 * Fetches data from Smoobu using the user's own API key.
 *
 * Supports two multi-tenant modes:
 *
 * 1. Per-user API key mode (smoobuApiKey set per user):
 *    Data is automatically scoped — each key only sees that owner's properties.
 *
 * 2. Single shared API key + propertyTagPrefix mode:
 *    All users share one Smoobu account. Each user has a propertyTagPrefix
 *    (e.g. "charmaine_") and only sees properties whose name starts with that prefix.
 *    Set SMOOBU_API_KEY in .env and leave smoobuApiKey null on the User.
 *    In this case, the route passes process.env.SMOOBU_API_KEY as apiKey.
 */

const SMOOBU_BASE = 'https://hostpilot-smoobu.onrender.com';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDefaultFrom() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function getDefaultTo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-12-31`;
}

function toYMD(dateStr) {
  return dateStr ? String(dateStr).slice(0, 10) : '';
}

async function smoobuFetch(path, apiKey) {
  const res = await fetch(`${SMOOBU_BASE}${path}`, {
    headers: {
      'Api-Key': apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(body.detail || `Smoobu ${path} returned ${res.status}`),
      { status: res.status }
    );
  }

  return res.json();
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.apiKey             - Smoobu API key (user's own or shared)
 * @param {string} [opts.from]             - Date range start YYYY-MM-DD
 * @param {string} [opts.to]               - Date range end YYYY-MM-DD
 * @param {string} [opts.ownerEmail]       - For metadata only
 * @param {string} [opts.ownerName]        - Display name on dashboard
 * @param {string} [opts.propertyTagPrefix] - If set, only show properties whose
 *                                           name starts with this prefix (case-insensitive).
 *                                           Used for single-Smoobu multi-tenant mode.
 */
export async function fetchSmoobuDashboard({
  apiKey,
  from,
  to,
  ownerEmail  = '',
  ownerName   = '',
  propertyTagPrefix = '',
}) {
  const dateFrom = from || getDefaultFrom();
  const dateTo   = to   || getDefaultTo();

  // Fetch properties and bookings in parallel
  const [propertiesData, bookingsData] = await Promise.all([
    smoobuFetch('/apartments', apiKey),
    smoobuFetch(
      `/reservations?arrivalTo=${dateTo}&departureFrom=${dateFrom}&pageSize=100`,
      apiKey
    ),
  ]);

  let properties = propertiesData?.apartments ?? propertiesData ?? [];
  let bookings   = bookingsData?.bookings ?? bookingsData?.reservations ?? [];

  // ── Property prefix filtering (single-Smoobu multi-tenant mode) ───────────
  if (propertyTagPrefix) {
    const prefix = propertyTagPrefix.toLowerCase();
    const allowedIds = new Set(
      properties
        .filter((p) => (p.name || '').toLowerCase().startsWith(prefix))
        .map((p) => p.id)
    );
    properties = properties.filter((p) => allowedIds.has(p.id));
    bookings   = bookings.filter((b) => b.apartment && allowedIds.has(b.apartment.id));
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const confirmedBookings = bookings.filter(
    (b) => b.type !== 'cancellation' && !b['is-blocked-booking']
  );
  const cancellations = bookings.filter((b) => b.type === 'cancellation');

  let totalRevenue = 0;
  let totalNights  = 0;

  confirmedBookings.forEach((b) => {
    totalRevenue += Number(b.price || 0);
    const arr = new Date(b.arrival);
    const dep = new Date(b.departure);
    if (!isNaN(arr) && !isNaN(dep)) {
      totalNights += Math.max(0, Math.round((dep - arr) / (1000 * 60 * 60 * 24)));
    }
  });

  const rangeDays = Math.max(
    1,
    Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24))
  );
  const totalAvailableNights = Math.max(1, properties.length * rangeDays);
  const occupancy = Math.min(100, Math.round((totalNights / totalAvailableNights) * 100));

  // ── By-channel breakdown ───────────────────────────────────────────────────
  const byChannel = {};
  confirmedBookings.forEach((b) => {
    const ch = b.channel?.name || 'Direct';
    if (!byChannel[ch]) byChannel[ch] = { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price || 0);
    byChannel[ch].bookings += 1;
    const arr = new Date(b.arrival);
    const dep = new Date(b.departure);
    if (!isNaN(arr) && !isNaN(dep)) {
      byChannel[ch].nights += Math.max(0, Math.round((dep - arr) / (1000 * 60 * 60 * 24)));
    }
  });

  // ── Revenue chart (monthly) ────────────────────────────────────────────────
  const revenueByMonth = {};
  confirmedBookings.forEach((b) => {
    const month = toYMD(b.arrival).slice(0, 7);
    if (!revenueByMonth[month]) revenueByMonth[month] = 0;
    revenueByMonth[month] += Number(b.price || 0);
  });

  const revenueChart = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));

  // ── Inbox ──────────────────────────────────────────────────────────────────
  const inbox = confirmedBookings
    .filter((b) => b['guest-name'])
    .sort((a, b) => new Date(b['created-at'] || b.arrival) - new Date(a['created-at'] || a.arrival))
    .slice(0, 20)
    .map((b) => ({
      reservationId: b.id,
      guestName:     b['guest-name'],
      channel:       b.channel?.name || 'Direct',
      arrival:       toYMD(b.arrival),
      departure:     toYMD(b.departure),
      property:      b.apartment?.name || '',
      unread:        0,
      lastMessage:   null,
    }));

  return {
    ownerName,
    ownerEmail,
    period:     { from: dateFrom, to: dateTo },
    stats: {
      revenue:       totalRevenue,
      bookings:      confirmedBookings.length,
      cancellations: cancellations.length,
      nights:        totalNights,
      occupancy,
    },
    byChannel,
    revenueChart,
    properties,
    bookings,
    inbox,
    totalUnread: 0,
  };
}