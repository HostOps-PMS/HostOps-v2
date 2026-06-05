// src/services/dashboardOverview.js
// ─────────────────────────────────────────────────────────────────
// Admin-level dashboard overview service.
//
// Fetches aggregated Smoobu data from ALL clients in the system.
// Each client has an embedded `properties[]` array, and each property
// has its own `smoobuApiKey`. This service loops through every client,
// every property, fetches their Smoobu data in parallel (with concurrency
// control), and merges them into a single admin overview payload.
//
// Returns:
//   - totalClients       — from User collection
//   - totalProperties    — total embedded properties across all clients
//   - topClients         — top N clients by total revenue (from Smoobu)
//   - monthlyRevenue     — total revenue across all properties this month
//   - revenueChart       — monthly revenue trend (all properties combined)
//   - bookingsTrend      — bookings + cancellations per month
//   - occupancyRate      — weighted average occupancy across all properties
//   - recentBookings     — latest N bookings across all properties
//   - recentCancellations— latest N cancellations across all properties
//   - alerts             — auto-generated alerts (overdue, low occupancy, etc.)
//   - recentActivities   — latest N activities across all properties
// ─────────────────────────────────────────────────────────────────

import User  from '../models/user.js';
import { getApartments, getBookings, getApiKeyForUser } from './smoobu.js';

// ── Helpers ───────────────────────────────────────────────────────

function toYMD(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 10);
}

function computeNights(b) {
  if (!b.arrival || !b.departure) return 0;
  const nights = Math.round(
    (new Date(b.departure) - new Date(b.arrival)) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, nights);
}

function getCurrentMonthRange() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const from  = `${year}-${month}-01`;
  // last day of this month
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const to      = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function getYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function getLast12MonthsRange() {
  const now  = new Date();
  const to   = now.toISOString().slice(0, 10);
  const from = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

/**
 * Run promises in batches to avoid hammering the Smoobu API.
 * @param {Function[]} tasks  — array of zero-arg async functions
 * @param {number}     limit  — max concurrent at a time
 */
async function runWithConcurrency(tasks, limit = 5) {
  const results = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map((fn) => fn().catch((err) => ({ error: err })));
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  return results;
}

// ── Per-property Smoobu fetcher ───────────────────────────────────

/**
 * Fetch bookings + apartments for a single property (smoobu api key).
 * Returns a normalized object with stats and raw lists.
 *
 * @param {{ smoobuApiKey: string, propertyTagPrefix?: string, _id: string }} propertyCtx
 * @param {{ from: string, to: string }}                                       dateRange
 * @param {string}                                                             clientId
 * @param {string}                                                             clientName
 * @param {string}                                                             propertyName
 */
async function fetchPropertyData(propertyCtx, dateRange, clientId, clientName, propertyName) {
  const { from, to } = dateRange;

  // Wide fetch window to catch cancellations with future arrival dates
  const wideFrom = new Date(from);
  wideFrom.setFullYear(wideFrom.getFullYear() - 1);
  const wideTo   = new Date(to);
  wideTo.setFullYear(wideTo.getFullYear() + 2);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const [apartmentsData, bookingsData] = await Promise.all([
    getApartments(propertyCtx),
    getBookings(propertyCtx, {
      from: fmt(wideFrom),
      to:   fmt(wideTo),
      showCancellation: true,
    }),
  ]);

  const apartments   = apartmentsData.apartments || [];
  const allBookings  = bookingsData.bookings     || [];

  // Filter bookings to the requested date range (arrival-based, matching Smoobu)
  const statsBookings = allBookings.filter((b) => {
    if (!b.arrival) return b.type === 'cancellation'; // dateless cancellations → include
    const arrival = b.arrival.slice(0, 10);
    return arrival >= from && arrival <= to;
  });

  let revenue = 0, nights = 0, bookingCount = 0, cancellations = 0, cancelledNights = 0;
  const byChannel = {};

  statsBookings.forEach((b) => {
    const n = computeNights(b);
    if (b.type === 'cancellation') {
      cancellations++;
      cancelledNights += n;
      return;
    }
    if (b['is-blocked-booking']) {
      bookingCount++;
      nights += n;
      return;
    }
    revenue       += Number(b.price) || 0;
    nights        += n;
    bookingCount++;
    const ch = b.channel?.name || 'Direct';
    byChannel[ch] = byChannel[ch] || { revenue: 0, bookings: 0, nights: 0 };
    byChannel[ch].revenue  += Number(b.price) || 0;
    byChannel[ch].bookings += 1;
    byChannel[ch].nights   += n;
  });

  // Occupancy
  const daysInRange = Math.max(
    1,
    Math.round((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24))
  );
  const availableNights = daysInRange * (apartments.length || 1);
  const occupancy = Math.min(100, Math.round((nights / availableNights) * 100));

  // Monthly revenue breakdown (for chart)
  const revenueByMonth = {};
  const bookingsByMonth = {};
  const cancellationsByMonth = {};

  allBookings.forEach((b) => {
    if (!b.arrival) return;
    const arrival = b.arrival.slice(0, 10);
    if (arrival < from || arrival > to) return;
    const month = arrival.slice(0, 7); // YYYY-MM

    if (b.type === 'cancellation') {
      cancellationsByMonth[month] = (cancellationsByMonth[month] || 0) + 1;
      return;
    }
    if (!b['is-blocked-booking']) {
      revenueByMonth[month]   = (revenueByMonth[month] || 0) + (Number(b.price) || 0);
      bookingsByMonth[month]  = (bookingsByMonth[month] || 0) + 1;
    }
  });

  // Recent confirmed bookings (for activity feed)
  const confirmedBookings = statsBookings
    .filter((b) => b.type !== 'cancellation' && !b['is-blocked-booking'])
    .sort((a, b_) => new Date(b_['created-at'] || b_.arrival) - new Date(a['created-at'] || a.arrival))
    .slice(0, 20)
    .map((b) => ({
      reservationId:  b.id,
      guestName:      b['guest-name'] || 'Guest',
      channel:        b.channel?.name || 'Direct',
      arrival:        toYMD(b.arrival),
      departure:      toYMD(b.departure),
      price:          Number(b.price) || 0,
      nights:         computeNights(b),
      propertyName,
      clientId,
      clientName,
      createdAt:      b['created-at'] || b.arrival,
    }));

  const recentCancellations = statsBookings
    .filter((b) => b.type === 'cancellation')
    .sort((a, b_) => new Date(b_['created-at'] || b_.arrival || 0) - new Date(a['created-at'] || a.arrival || 0))
    .slice(0, 10)
    .map((b) => ({
      reservationId: b.id,
      guestName:     b['guest-name'] || 'Guest',
      channel:       b.channel?.name || 'Direct',
      arrival:       toYMD(b.arrival),
      departure:     toYMD(b.departure),
      nights:        computeNights(b),
      propertyName,
      clientId,
      clientName,
      createdAt:     b['created-at'] || b.arrival || null,
    }));

  return {
    clientId,
    clientName,
    propertyName,
    stats: { revenue, nights, bookingCount, cancellations, cancelledNights, occupancy },
    byChannel,
    revenueByMonth,
    bookingsByMonth,
    cancellationsByMonth,
    apartments,
    confirmedBookings,
    recentCancellations,
    daysInRange,
    availableNights,
  };
}

// ── Alert generator ───────────────────────────────────────────────

/**
 * Auto-generate alerts from aggregated property data.
 * Alerts are similar in shape to the frontend's AlertsCenter constants.
 */
function generateAlerts(propertyResults) {
  const alerts = [];
  let id = 1;

  propertyResults.forEach((r) => {
    if (r.error) return;

    // Low occupancy (below 60%)
    if (r.stats.occupancy < 60 && r.stats.occupancy >= 0) {
      alerts.push({
        id:        id++,
        type:      'warning',
        title:     'Low Occupancy Detected',
        desc:      `${r.propertyName} occupancy is at ${r.stats.occupancy}%.`,
        time:      'now',
        unread:    0,
        avatar:    (r.propertyName || 'PR').slice(0, 2).toUpperCase(),
        avatarBg:  '#d97706',
        clientId:  r.clientId,
        clientName: r.clientName,
      });
    }

    // High cancellation rate (>20% of bookings)
    const total = r.stats.bookingCount + r.stats.cancellations;
    const cancelRate = total > 0 ? (r.stats.cancellations / total) * 100 : 0;
    if (cancelRate > 20 && r.stats.cancellations > 0) {
      alerts.push({
        id:        id++,
        type:      'danger',
        title:     'High Cancellation Rate',
        desc:      `${r.propertyName} has a ${Math.round(cancelRate)}% cancellation rate this period.`,
        time:      'now',
        unread:    r.stats.cancellations,
        avatar:    (r.propertyName || 'PR').slice(0, 2).toUpperCase(),
        avatarBg:  '#dc2626',
        clientId:  r.clientId,
        clientName: r.clientName,
      });
    }

    // No bookings this month (potential connectivity/visibility issue)
    if (r.stats.bookingCount === 0 && r.stats.revenue === 0 && r.apartments.length > 0) {
      alerts.push({
        id:        id++,
        type:      'info',
        title:     'No Bookings This Month',
        desc:      `${r.propertyName} has no confirmed bookings for this period.`,
        time:      'now',
        unread:    0,
        avatar:    (r.propertyName || 'PR').slice(0, 2).toUpperCase(),
        avatarBg:  '#2563eb',
        clientId:  r.clientId,
        clientName: r.clientName,
      });
    }

    // Good occupancy (above 85%) → success alert
    if (r.stats.occupancy >= 85) {
      alerts.push({
        id:        id++,
        type:      'success',
        title:     'High Occupancy',
        desc:      `${r.propertyName} is at ${r.stats.occupancy}% occupancy. Great performance!`,
        time:      'now',
        unread:    0,
        avatar:    (r.propertyName || 'PR').slice(0, 2).toUpperCase(),
        avatarBg:  '#059669',
        clientId:  r.clientId,
        clientName: r.clientName,
      });
    }
  });

  // Sort: danger first, then warning, then info, then success
  const ORDER = { danger: 0, warning: 1, info: 2, success: 3 };
  alerts.sort((a, b) => (ORDER[a.type] ?? 9) - (ORDER[b.type] ?? 9));

  return alerts;
}

// ── Recent Activities builder ─────────────────────────────────────

function buildRecentActivities(propertyResults, limit = 20) {
  const activities = [];

  propertyResults.forEach((r) => {
    if (r.error) return;

    // Confirmed bookings → booking activity
    r.confirmedBookings.forEach((b) => {
      activities.push({
        type:         'booking',
        actor:        b.guestName,
        action:       'created a new booking',
        target:       `${b.propertyName} · ${b.arrival} → ${b.departure}`,
        time:         b.createdAt,
        avatar:       (b.guestName || 'G').slice(0, 2).toUpperCase(),
        channel:      b.channel,
        price:        b.price,
        propertyName: b.propertyName,
        clientName:   b.clientName,
      });
    });

    // Cancellations → cancel activity
    r.recentCancellations.forEach((b) => {
      activities.push({
        type:         'cancel',
        actor:        b.guestName,
        action:       'cancelled booking',
        target:       `${b.propertyName}${b.arrival ? ' · ' + b.arrival : ''}`,
        time:         b.createdAt,
        avatar:       (b.guestName || 'G').slice(0, 2).toUpperCase(),
        channel:      b.channel,
        propertyName: b.propertyName,
        clientName:   b.clientName,
      });
    });
  });

  // Sort by most recent and limit
  activities.sort((a, b) => {
    const aTime = a.time ? new Date(a.time).getTime() : 0;
    const bTime = b.time ? new Date(b.time).getTime() : 0;
    return bTime - aTime;
  });

  // Format relative time
  const now = Date.now();
  return activities.slice(0, limit).map((act, i) => {
    const diffMs = act.time ? now - new Date(act.time).getTime() : 0;
    const diffMin  = Math.floor(diffMs / 60000);
    const diffHr   = Math.floor(diffMs / 3600000);
    const diffDay  = Math.floor(diffMs / 86400000);
    let relTime = 'just now';
    if (diffMin  >= 1 && diffMin  < 60)  relTime = `${diffMin}m ago`;
    if (diffHr   >= 1 && diffHr   < 24)  relTime = `${diffHr}h ago`;
    if (diffDay  >= 1)                   relTime = `${diffDay}d ago`;
    return { id: i + 1, ...act, time: relTime };
  });
}

// ── Main export ───────────────────────────────────────────────────

/**
 * Fetch and aggregate the full admin dashboard overview.
 *
 * @param {{ from?: string, to?: string }} opts  — optional date range override
 * @returns {Promise<DashboardOverviewPayload>}
 */
export async function getDashboardOverview(opts = {}) {
  // ── 1. Load all clients + their embedded properties (with smoobuApiKey) ──
  const allClients = await User.find({ role: { $in: ['client', 'team_leader', 'admin'] } })
    .select('+properties.smoobuApiKey businessName firstName lastName email role createdAt properties')
    .lean();

  const totalClients    = await User.countDocuments({ role: 'client' });
  const totalProperties = allClients.reduce((sum, c) => sum + (c.properties?.length || 0), 0);

  // ── 2. Determine date ranges ──────────────────────────────────────────────
  const { from: monthFrom, to: monthTo } = getCurrentMonthRange();
  const { from: yearFrom, to: yearTo }   = getYearRange();
  const chartRange                       = getLast12MonthsRange();

  const statsRange = {
    from: opts.from || monthFrom,
    to:   opts.to   || monthTo,
  };

  // ── 3. Build per-property fetch tasks ─────────────────────────────────────
  // We run two parallel passes:
  //   statsPass  → current month / requested range  (for KPI totals)
  //   chartPass  → last 12 months                   (for trend charts)
  // Both passes share the same property context.

  const propertyTasks = [];

  allClients.forEach((client) => {
    const clientName = client.businessName ||
      [client.firstName, client.lastName].filter(Boolean).join(' ') ||
      client.email;

    (client.properties || []).forEach((prop) => {
      if (!prop.smoobuApiKey || !prop.smoobuApiKey.trim()) return; // skip unconnected

      const propertyCtx = {
        _id:               String(prop._id),
        smoobuApiKey:      prop.smoobuApiKey.trim(),
        propertyTagPrefix: client.propertyTagPrefix || '',
      };
      const propName = prop.propertyName || 'Property';

      propertyTasks.push({
        propName,
        clientId: String(client._id),
        clientName,
        propertyCtx,
        clientDoc: client,
      });
    });
  });

  // ── 4. Fetch data from Smoobu for all properties (concurrency limited) ────
  const statsTasks  = propertyTasks.map(({ propName, clientId, clientName, propertyCtx }) =>
    () => fetchPropertyData(propertyCtx, statsRange, clientId, clientName, propName)
  );
  const chartTasks  = propertyTasks.map(({ propName, clientId, clientName, propertyCtx }) =>
    () => fetchPropertyData(propertyCtx, chartRange, clientId, clientName, propName)
  );

  const [statsResults, chartResults] = await Promise.all([
    runWithConcurrency(statsTasks, 5),
    runWithConcurrency(chartTasks, 5),
  ]);

  // ── 5. Aggregate KPI totals (stats range) ─────────────────────────────────
  let totalRevenue = 0, totalBookings = 0, totalCancellations = 0;
  let totalNights = 0, totalAvailableNights = 0;
  const clientRevenueMap = {}; // clientId → { name, revenue, bookings, properties[] }
  const channelMap       = {}; // channel  → { revenue, bookings, nights }
  const propertyOccupancy = []; // for occupancy gauge

  statsResults.forEach((r) => {
    if (!r || r.error) return;

    totalRevenue       += r.stats.revenue;
    totalBookings      += r.stats.bookingCount;
    totalCancellations += r.stats.cancellations;
    totalNights        += r.stats.nights;
    totalAvailableNights += r.stats.availableNights;

    // Per-client revenue accumulation (for Top Clients)
    if (!clientRevenueMap[r.clientId]) {
      clientRevenueMap[r.clientId] = {
        clientId:    r.clientId,
        clientName:  r.clientName,
        revenue:     0,
        bookings:    0,
        properties:  [],
      };
    }
    clientRevenueMap[r.clientId].revenue  += r.stats.revenue;
    clientRevenueMap[r.clientId].bookings += r.stats.bookingCount;
    clientRevenueMap[r.clientId].properties.push({
      propertyName: r.propertyName,
      revenue:      r.stats.revenue,
      occupancy:    r.stats.occupancy,
      bookings:     r.stats.bookingCount,
    });

    // Channel breakdown
    Object.entries(r.byChannel).forEach(([ch, v]) => {
      channelMap[ch] = channelMap[ch] || { revenue: 0, bookings: 0, nights: 0 };
      channelMap[ch].revenue  += v.revenue;
      channelMap[ch].bookings += v.bookings;
      channelMap[ch].nights   += v.nights;
    });

    // Occupancy per property
    propertyOccupancy.push({
      propertyName: r.propertyName,
      clientName:   r.clientName,
      occupancy:    r.stats.occupancy,
    });
  });

  const overallOccupancy = totalAvailableNights > 0
    ? Math.min(100, Math.round((totalNights / totalAvailableNights) * 100))
    : 0;

  // ── 6. Top Clients (sorted by revenue) ───────────────────────────────────
  const topClients = Object.values(clientRevenueMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((c, i) => ({
      rank:        i + 1,
      clientId:    c.clientId,
      clientName:  c.clientName,
      revenue:     c.revenue,
      bookings:    c.bookings,
      properties:  c.properties,
    }));

  // ── 7. Revenue & Bookings Chart (last 12 months) ──────────────────────────
  // Merge all properties' monthly data into one series
  const mergedRevByMonth  = {};
  const mergedBkByMonth   = {};
  const mergedCxByMonth   = {};

  chartResults.forEach((r) => {
    if (!r || r.error) return;
    Object.entries(r.revenueByMonth).forEach(([m, v]) => {
      mergedRevByMonth[m] = (mergedRevByMonth[m] || 0) + v;
    });
    Object.entries(r.bookingsByMonth).forEach(([m, v]) => {
      mergedBkByMonth[m] = (mergedBkByMonth[m] || 0) + v;
    });
    Object.entries(r.cancellationsByMonth).forEach(([m, v]) => {
      mergedCxByMonth[m] = (mergedCxByMonth[m] || 0) + v;
    });
  });

  // Build unified sorted chart array
  const allMonths = new Set([
    ...Object.keys(mergedRevByMonth),
    ...Object.keys(mergedBkByMonth),
    ...Object.keys(mergedCxByMonth),
  ]);

  const revenueChart = Array.from(allMonths)
    .sort()
    .map((month) => ({
      month,
      // Friendly label: "Jan 25" etc.
      label:         new Date(month + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
      revenue:       mergedRevByMonth[month] || 0,
      bookings:      mergedBkByMonth[month]  || 0,
      cancellations: mergedCxByMonth[month]  || 0,
    }));

  // ── 8. Monthly Revenue KPI (current month total) ─────────────────────────
  const monthlyRevenue = totalRevenue; // already scoped to statsRange (current month)

  // ── 9. Recent Bookings & Cancellations ───────────────────────────────────
  const allConfirmedBookings = statsResults
    .filter((r) => r && !r.error)
    .flatMap((r) => r.confirmedBookings);

  const allCancellations = statsResults
    .filter((r) => r && !r.error)
    .flatMap((r) => r.recentCancellations);

  allConfirmedBookings.sort((a, b) =>
    new Date(b.createdAt || b.arrival || 0) - new Date(a.createdAt || a.arrival || 0)
  );
  allCancellations.sort((a, b) =>
    new Date(b.createdAt || b.arrival || 0) - new Date(a.createdAt || a.arrival || 0)
  );

  const recentBookings      = allConfirmedBookings.slice(0, 20);
  const recentCancellations = allCancellations.slice(0, 10);

  // ── 10. Alerts ────────────────────────────────────────────────────────────
  const alerts = generateAlerts(statsResults.filter((r) => r && !r.error));

  // ── 11. Recent Activities ─────────────────────────────────────────────────
  const recentActivities = buildRecentActivities(
    statsResults.filter((r) => r && !r.error),
    20
  );

  // ── 12. Occupancy per property (top 10 for gauge) ────────────────────────
  const occupancyBreakdown = propertyOccupancy
    .sort((a, b) => b.occupancy - a.occupancy)
    .slice(0, 10);

  // ── 13. Return assembled payload ─────────────────────────────────────────
  return {
    // KPI counters (from DB)
    totalClients,
    totalProperties,

    // KPI counters (from Smoobu)
    monthlyRevenue,
    totalBookings,
    totalCancellations,
    overallOccupancy,

    // Date context
    period: {
      from:  statsRange.from,
      to:    statsRange.to,
    },

    // Charts
    revenueChart,       // [{month, label, revenue, bookings, cancellations}]

    // Tables / lists
    topClients,         // [{rank, clientId, clientName, revenue, bookings, properties[]}]
    occupancyBreakdown, // [{propertyName, clientName, occupancy}]
    recentBookings,     // [{reservationId, guestName, channel, arrival, departure, price, nights, propertyName, clientName}]
    recentCancellations,// [{reservationId, guestName, channel, arrival, nights, propertyName, clientName}]

    // Feeds
    alerts,             // [{id, type, title, desc, time, unread, avatar, avatarBg, clientId, clientName}]
    recentActivities,   // [{id, type, actor, action, target, time, avatar, channel}]

    // Channel breakdown (for charts if needed)
    byChannel: channelMap,

    // Metadata
    fetchedAt: new Date().toISOString(),
    connectedProperties: propertyTasks.length,
  };
}
