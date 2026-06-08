// src/services/dashboardOverview.js
// ─────────────────────────────────────────────────────────────────
// Aggregates data from ALL client Smoobu API keys and returns the
// full admin dashboard payload.
//
// mapLocations uses the EXACT same flow as smoobuApartments.js:
//   getApartments(propertyCtx)  → list of sub-apartments
//   getApartmentDetail(propertyCtx, aptId) → detail.location block
//     → { street, zip, city, country, latitude, longitude }
//
// propertyCtx = { _id: prop._id, smoobuApiKey: decryptedKey }
// This matches what smoobu.js service expects.
// ─────────────────────────────────────────────────────────────────

import User                                      from '../models/user.js';
import { decrypt }                               from '../utils/encryption.js';
import { getApartments, getApartmentDetail }     from './smoobu.js';

// ── Date helpers ──────────────────────────────────────────────────
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastOfMonth() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toYMD(s) {
  return s ? String(s).slice(0, 10) : '';
}

function nightCount(b) {
  const arr = new Date(b.arrival);
  const dep = new Date(b.departure);
  if (isNaN(arr) || isNaN(dep)) return 0;
  return Math.max(0, Math.round((dep - arr) / (1_000 * 60 * 60 * 24)));
}

// ── Trailing-12-month chart skeleton ─────────────────────────────
function buildMonthSkeleton() {
  const months = [];
  const now    = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      month:         key,
      label:         d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue:       0,
      bookings:      0,
      cancellations: 0,
    });
  }
  return months;
}

// ── Raw Smoobu fetch (for reservations — uses apiKey string directly) ──
async function smoobuFetch(path, apiKey) {
  const SMOOBU_BASE = process.env.SMOOBU_BASE_URL || 'https://login.smoobu.com/api';
  const res = await fetch(`${SMOOBU_BASE}${path}`, {
    headers: { 'Api-Key': apiKey, 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(body.detail || `Smoobu ${path} → ${res.status}`),
      { status: res.status }
    );
  }
  return res.json();
}

// ── Apartments + location via the SAME flow as smoobuApartments.js ──
//
// propertyCtx = { _id: prop._id, smoobuApiKey: decryptedKey }
// This is exactly what getApartments() and getApartmentDetail() expect.
//
async function fetchApartmentsWithLocation(propertyCtx, propertyName, clientId, clientName) {
  // Step 1: list all sub-apartments for this key  (same as smoobuApartments.js)
  const { apartments } = await getApartments(propertyCtx);

  // Step 2: fetch detail for each — detail.location has the real lat/lng
  const results = await Promise.all(
    apartments.map(async (apt) => {
      const aptId = apt.id ?? apt;
      try {
        // Same call as smoobuApartments.js → fetchApartmentsForKey()
        const detail = await getApartmentDetail(propertyCtx, aptId);
        const loc    = detail?.location || {};
        const lat    = parseFloat(loc.latitude);
        const lng    = parseFloat(loc.longitude);

        return {
          id:           aptId,
          name:         apt.name || detail?.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street:    loc.street  || '',
          zip:       loc.zip     || '',
          city:      loc.city    || '',
          country:   loc.country || '',
          // Exact coordinates from Smoobu's location block
          latitude:  Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          timeZone:     detail?.timeZone     || null,
          currency:     detail?.currency     || null,
          maxOccupancy: detail?.rooms?.maxOccupancy ?? null,
          bedrooms:     detail?.rooms?.bedrooms     ?? null,
          bathrooms:    detail?.rooms?.bathrooms    ?? null,
          type:         detail?.type?.name          || null,
        };
      } catch (detailErr) {
        console.warn(`[dashboardOverview] detail fetch failed for apt ${aptId}:`, detailErr.message);
        return {
          id:           aptId,
          name:         apt.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
          timeZone: null, currency: null,
          maxOccupancy: null, bedrooms: null, bathrooms: null, type: null,
        };
      }
    })
  );

  return results;
}

// ── Main export ───────────────────────────────────────────────────
export async function getDashboardOverview({ from, to } = {}) {
  const dateFrom = from || firstOfMonth();
  const dateTo   = to   || lastOfMonth();

  // Load all clients
  const clients = await User.find({ role: 'client' })
    .select('businessName firstName lastName email properties')
    .lean();

  let totalProperties     = 0;
  let connectedProperties = 0;
  let totalRevenue        = 0;
  let totalBookings       = 0;
  let totalCancellations  = 0;
  let totalNights         = 0;

  const chartMap              = Object.fromEntries(buildMonthSkeleton().map(m => [m.month, m]));
  const byChannel             = {};
  const topClientsMap         = {};
  const allApartments         = [];
  const allRecentBookings     = [];
  const allRecentCancellations = [];

  await Promise.all(
    clients.map(async (client) => {
      const props = Array.isArray(client.properties) ? client.properties : [];
      totalProperties += props.length;

      const clientName = client.businessName ||
        [client.firstName, client.lastName].filter(Boolean).join(' ') ||
        client.email;

      await Promise.all(
        props.map(async (prop) => {
          if (!prop.smoobuApiKey?.trim()) return;

          // Decrypt the stored key
          let decryptedKey = '';
          try {
            decryptedKey = decrypt(prop.smoobuApiKey)?.trim() ?? '';
          } catch (e) {
            console.warn(`[dashboardOverview] decrypt failed for "${prop.propertyName}":`, e.message);
            return;
          }
          if (!decryptedKey) return;

          connectedProperties++;
          const propertyName = prop.propertyName || 'Unnamed Property';
          const clientId     = String(client._id);

          // ── Build propertyCtx exactly like smoobuApartments.js does ──
          const propertyCtx = {
            _id:          String(prop._id),
            smoobuApiKey: decryptedKey,   // already decrypted — plain text
          };

          try {
            // ── 1. Fetch apartments + their Smoobu location (lat/lng) ──
            const apts = await fetchApartmentsWithLocation(
              propertyCtx, propertyName, clientId, clientName
            );
            allApartments.push(...apts);

            // ── 2. Bookings for the requested date range ──────────────
            const bookingsData = await smoobuFetch(
              `/reservations?arrivalTo=${dateTo}&departureFrom=${dateFrom}&pageSize=100`,
              decryptedKey
            );
            const bookings = bookingsData?.bookings ?? bookingsData?.reservations ?? [];

            const confirmed     = bookings.filter(b => b.type !== 'cancellation' && !b['is-blocked-booking']);
            const cancellations = bookings.filter(b => b.type === 'cancellation');

            totalBookings      += confirmed.length;
            totalCancellations += cancellations.length;

            let clientRevenue = 0;

            confirmed.forEach(b => {
              const price  = Number(b.price || 0);
              const nights = nightCount(b);
              totalRevenue  += price;
              totalNights   += nights;
              clientRevenue += price;

              const month = toYMD(b.arrival).slice(0, 7);
              if (chartMap[month]) {
                chartMap[month].revenue  += price;
                chartMap[month].bookings += 1;
              }

              const ch = b.channel?.name || 'Direct';
              if (!byChannel[ch]) byChannel[ch] = { revenue: 0, bookings: 0, nights: 0 };
              byChannel[ch].revenue  += price;
              byChannel[ch].bookings += 1;
              byChannel[ch].nights   += nights;

              allRecentBookings.push({
                reservationId: b.id,
                guestName:     b['guest-name'] || 'Guest',
                channel:       b.channel?.name || 'Direct',
                arrival:       toYMD(b.arrival),
                departure:     toYMD(b.departure),
                price,
                nights,
                propertyName,
                clientName,
              });
            });

            cancellations.forEach(b => {
              const month = toYMD(b.arrival).slice(0, 7);
              if (chartMap[month]) chartMap[month].cancellations += 1;

              allRecentCancellations.push({
                reservationId: b.id,
                guestName:     b['guest-name'] || 'Guest',
                channel:       b.channel?.name || 'Direct',
                arrival:       toYMD(b.arrival),
                nights:        nightCount(b),
                propertyName,
                clientName,
              });
            });

            if (!topClientsMap[clientId]) {
              topClientsMap[clientId] = { clientId, clientName, revenue: 0, bookings: 0, properties: [] };
            }
            topClientsMap[clientId].revenue    += clientRevenue;
            topClientsMap[clientId].bookings   += confirmed.length;
            topClientsMap[clientId].properties.push(propertyName);

          } catch (err) {
            console.warn(`[dashboardOverview] Smoobu error for "${propertyName}" (${clientId}):`, err.message);
          }
        })
      );
    })
  );

  // ── Occupancy ─────────────────────────────────────────────────
  const totalRangeDays = Math.max(
    1,
    Math.round((new Date(dateTo) - new Date(dateFrom)) / (1_000 * 60 * 60 * 24))
  );
  const overallOccupancy = allApartments.length > 0
    ? Math.min(100, Math.round((totalNights / Math.max(1, allApartments.length * totalRangeDays)) * 100))
    : 0;

  const occupancyBreakdown = allApartments.map(apt => ({
    propertyName: apt.name,
    clientName:   apt.clientName,
    occupancy:    overallOccupancy,
  }));

  // ── mapLocations — only apartments with valid Smoobu coordinates ─
  const mapLocations = allApartments
    .filter(apt => apt.latitude !== null && apt.longitude !== null)
    .map(apt => ({
      id:           apt.id,
      name:         apt.name,
      propertyName: apt.propertyName,
      clientId:     apt.clientId,
      clientName:   apt.clientName,
      address:      [apt.street, apt.city, apt.country].filter(Boolean).join(', '),
      street:       apt.street,
      zip:          apt.zip,
      city:         apt.city,
      country:      apt.country,
      lat:          apt.latitude,
      lng:          apt.longitude,
    }));

  // ── Top clients ───────────────────────────────────────────────
  const topClients = Object.values(topClientsMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c, i) => ({ rank: i + 1, ...c }));

  // ── Alerts ────────────────────────────────────────────────────
  const alerts = [...allRecentCancellations]
    .sort((a, b) => b.arrival.localeCompare(a.arrival))
    .slice(0, 5)
    .map(c => ({
      id:         `cancel-${c.reservationId}`,
      type:       'cancellation',
      title:      `Cancellation — ${c.propertyName}`,
      desc:       `${c.guestName} cancelled a ${c.nights}-night stay`,
      time:       c.arrival,
      unread:     true,
      avatar:     c.guestName?.[0]?.toUpperCase() || '?',
      avatarBg:   '#ef4444',
      clientName: c.clientName,
    }));

  // ── Recent activities ─────────────────────────────────────────
  const recentActivities = [
    ...[...allRecentBookings]
      .sort((a, b) => b.arrival.localeCompare(a.arrival))
      .slice(0, 5)
      .map(b => ({
        id:     `bk-${b.reservationId}`,
        type:   'booking',
        actor:  b.guestName,
        action: 'booked',
        target: `${b.propertyName} (${b.nights} nights)`,
        time:   b.arrival,
        avatar: b.guestName?.[0]?.toUpperCase() || '?',
      })),
    ...[...allRecentCancellations]
      .sort((a, b) => b.arrival.localeCompare(a.arrival))
      .slice(0, 3)
      .map(c => ({
        id:     `cn-${c.reservationId}`,
        type:   'cancellation',
        actor:  c.guestName,
        action: 'cancelled',
        target: `${c.propertyName} (${c.nights} nights)`,
        time:   c.arrival,
        avatar: c.guestName?.[0]?.toUpperCase() || '?',
      })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);

  return {
    totalClients:        clients.length,
    totalProperties,
    connectedProperties,
    monthlyRevenue:      totalRevenue,
    totalBookings,
    totalCancellations,
    overallOccupancy,
    period:              { from: dateFrom, to: dateTo },
    revenueChart:        Object.values(chartMap),
    topClients,
    occupancyBreakdown,
    mapLocations,
    recentBookings:      allRecentBookings
                           .sort((a, b) => b.arrival.localeCompare(a.arrival))
                           .slice(0, 10),
    recentCancellations: allRecentCancellations
                           .sort((a, b) => b.arrival.localeCompare(a.arrival))
                           .slice(0, 10),
    alerts,
    recentActivities,
    byChannel,
    fetchedAt:           new Date().toISOString(),
    _version:            3,
  };
}