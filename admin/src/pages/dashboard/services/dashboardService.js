/**
 * dashboardService.js
 * Centralized API calls for the dashboard page.
 * All functions return plain JS objects — hooks handle state.
 *
 * Base URL is read from .env:
 *   VITE_API_BASE_URL=https://api.example.com
 *
 * FIX: Added retry + token-refresh-aware logic so a stale token on first
 * render (common in deployed environments where sessionStorage hydrates
 * slightly after the component mounts) doesn't permanently break the fetch.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function getToken() {
  // Try sessionStorage first (runtime token after login),
  // then localStorage as a fallback (some auth flows persist there).
  return (
    sessionStorage.getItem('hp_access_token') ??
    localStorage.getItem('hp_access_token') ??
    ''
  );
}

/**
 * Core request helper.
 * Retries once after a short delay on 401 — covers the race where
 * sessionStorage hasn't been written yet on the very first render
 * in a deployed environment.
 */
async function request(path, options = {}, _retried = false) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${getToken()}`,
      'x-api-key':    import.meta.env.VITE_API_KEY ?? '',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  // On 401 in production, wait 300 ms and retry once — the token may have
  // just been written to sessionStorage by the auth flow.
  if (res.status === 401 && !_retried) {
    await new Promise(r => setTimeout(r, 300));
    return request(path, options, true);
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${msg}`);
  }

  return res.json();
}

/* ── Stats (legacy mock-backed) ────────────────────────────────── */

/**
 * GET /dashboard/stats
 * @returns {{ label, value, change, trend, color, icon }[]}
 */
export async function getStats() {
  return request('/dashboard/stats');
}

/* ── Dashboard Overview (live Smoobu aggregation) ───────────────── */

/**
 * GET /api/dashboard-overview
 *
 * Returns aggregated admin overview from all client Smoobu API keys.
 * Includes: totalClients, totalProperties, monthlyRevenue, totalBookings,
 * totalCancellations, overallOccupancy, revenueChart, topClients,
 * occupancyBreakdown, recentBookings, recentCancellations, alerts,
 * recentActivities, byChannel, mapLocations.
 *
 * @param {{ from?: string, to?: string }} opts  — optional YYYY-MM-DD date range
 * @returns {Promise<DashboardOverviewPayload>}
 */
export async function getDashboardOverview({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  const qs = params.toString() ? '?' + params.toString() : '';
  return request(`/api/dashboard-overview${qs}`);
}

/* ── Orders ─────────────────────────────────────────────────────── */

/**
 * GET /orders/recent?limit=N
 * @param {number} limit
 * @returns {{ id, customer, product, amount, status, date }[]}
 */
export async function getRecentOrders(limit = 10) {
  return request(`/orders/recent?limit=${limit}`);
}

/**
 * POST /orders
 * @param {{ customer, product, amount, status }} payload
 */
export async function createOrder(payload) {
  return request('/orders', { method: 'POST', body: JSON.stringify(payload) });
}

const dashboardService = { getStats, getDashboardOverview, getRecentOrders, createOrder };
export default dashboardService;