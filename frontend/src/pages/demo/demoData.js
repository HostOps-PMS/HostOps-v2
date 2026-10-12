// Sample data and the stand-in auth object for the public /demo page (see index.jsx).
// No login, no network calls: authFetch short-circuits on auth.demoFetch.

const DAY = 864e5;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

const PROPERTIES = [
  { id: 101, name: 'Seaside Villa – Boracay', rate: 6500 },
  { id: 102, name: 'City Loft – Makati', rate: 3800 },
  { id: 103, name: 'Pine Cabin – Baguio', rate: 4500 },
];
const CHANNELS = ['Airbnb', 'Booking.com', 'Airbnb', 'VRBO', 'Direct', 'Agoda'];
const GUESTS = ['Maria Santos', 'John Reyes', 'Aiko Tanaka', 'Liam Cruz', 'Sofia Garcia', 'Noah Kim',
  'Isabella Lim', 'Ethan Dela Cruz', 'Chloe Tan', 'Lucas Villanueva', 'Mia Ramos', 'Daniel Ong'];

// Fixed seed so the demo looks the same on every visit.
function makeBookings() {
  let seed = 7;
  const rand = (n) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * n); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const bookings = [];
  let id = 5000;
  for (const p of PROPERTIES) {
    let day = addDays(today, -180);
    const end = addDays(today, 180);
    while (day < end) {
      day = addDays(day, rand(4));
      const nights = 2 + rand(5);
      const departure = addDays(day, nights);
      const channel = CHANNELS[rand(CHANNELS.length)];
      bookings.push({
        id: id++,
        type: rand(15) === 0 ? 'cancellation' : 'reservation',
        'is-blocked-booking': false,
        arrival: iso(day),
        departure: iso(departure),
        'created-at': iso(addDays(day, -14 - rand(30))),
        'guest-name': GUESTS[rand(GUESTS.length)],
        adults: 1 + rand(4),
        children: rand(3),
        price: nights * p.rate,
        channel: { id: channel, name: channel },
        apartment: { id: p.id, name: p.name },
      });
      day = departure;
    }
  }
  return bookings;
}

const BOOKINGS = makeBookings();
const PROPS = PROPERTIES.map(({ id, name }) => ({ id, name }));

// Same math as backend routes/dashboard.js recalcStats(), so numbers match a real account.
function dashboard({ from, to }) {
  const inRange = BOOKINGS.filter((b) => b.arrival >= from && b.arrival <= to);
  const stats = { revenue: 0, bookings: 0, cancellations: 0, nights: 0, cancelledNights: 0, occupancy: 0 };
  const byChannel = {};
  const byMonth = {};
  for (const b of inRange) {
    const nights = Math.round((new Date(b.departure) - new Date(b.arrival)) / DAY);
    if (b.type === 'cancellation') { stats.cancellations++; stats.cancelledNights += nights; continue; }
    stats.bookings++; stats.nights += nights; stats.revenue += b.price;
    const ch = byChannel[b.channel.name] ||= { revenue: 0, bookings: 0, nights: 0 };
    ch.revenue += b.price; ch.bookings++; ch.nights += nights;
    byMonth[b.arrival.slice(0, 7)] = (byMonth[b.arrival.slice(0, 7)] || 0) + b.price;
  }
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / DAY));
  stats.occupancy = Math.min(100, Math.round((stats.nights / (days * PROPS.length)) * 100));

  const today = iso(new Date());
  const inbox = BOOKINGS
    .filter((b) => b.type !== 'cancellation' && b.departure >= today)
    .sort((a, b) => a.arrival.localeCompare(b.arrival)) // nearest stays first, across all properties
    .slice(0, 12)
    .map((b, i) => ({
      reservationId: b.id,
      guestName: b['guest-name'],
      apartmentId: b.apartment.id,
      property: b.apartment.name,
      channel: b.channel.name,
      arrival: b.arrival,
      departure: b.departure,
      // Spread over the last few days, newest first (never in the future).
      latestMessage: { body: 'Hi! What time is check-in?', subject: '', createdAt: new Date(Date.now() - (i * 7 + 1) * 3600e3).toISOString(), fromGuest: true },
      unread: i < 3 ? 1 : 0,
      bookingType: b.type,
      hasThread: true,
    }));

  return {
    demo: true,
    ownerName: 'Demo Host',
    period: { from, to, days },
    stats,
    byChannel,
    revenueChart: Object.keys(byMonth).sort().map((month) => ({ month, revenue: byMonth[month] })),
    properties: PROPS,
    bookings: BOOKINGS,
    inbox,
    totalUnread: inbox.reduce((s, t) => s + t.unread, 0),
    totalThreads: inbox.length,
  };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function demoFetch(path, options = {}) {
  if (path.includes('/api/dashboard')) return Promise.resolve(json(dashboard(JSON.parse(options.body || '{}'))));
  if (path.includes('/api/messages/reply')) return Promise.resolve(json({ ok: true }));
  if (path.includes('/api/messages/')) {
    return Promise.resolve(json({ messages: [
      { type: 1, subject: 'Check-in', message: 'Hi! What time is check-in?', 'created-at': iso(addDays(new Date(), -1)) },
      { type: 2, subject: 'Re: Check-in', message: 'Hello! Check-in is from 2:00 PM. See you soon!', 'created-at': iso(new Date()) },
    ] }));
  }
  if (path.includes('/my-properties')) return Promise.resolve(json({ properties: [] }));
  if (path.includes('/announcements')) return Promise.resolve(json([]));
  // Account actions (PIN, password, 2FA, profile): nothing is real here, so say so instead of faking success.
  if (path.includes('/auth/')) return Promise.resolve(json({ error: 'This is a demo. Account settings are turned off.' }, 403));
  return Promise.resolve(json({})); // activity log and anything else: silent no-op
}

const DEMO_USER = { firstName: 'Demo', lastName: 'Host', businessName: 'Demo Host', email: 'demo@hostops.online', isVerified: true };

export const demoAuth = {
  isReady: true,
  demoFetch,
  fetchWithAuth: (url, options) => demoFetch(url, options),
  getToken: () => 'demo',
  setToken: () => {},
  getSessionKey: () => null,
  setSessionKey: () => {},
  refreshToken: async () => null,
  getUser: () => DEMO_USER,
  setUser: () => {},
  clear: () => {},
  logout: async () => {}, // demo "Log out" must not end the visitor's real session
  storageIsPersistent: false,
};
