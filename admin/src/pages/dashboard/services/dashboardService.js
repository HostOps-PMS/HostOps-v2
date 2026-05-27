/**
 * dashboardService.js
 * Centralized API calls for the dashboard page.
 * All functions return plain JS objects — hooks handle state.
 *
 * Base URL is read from .env:
 *   VITE_API_BASE_URL=https://api.example.com
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${msg}`);
  }

  return res.json();
}

/* ── Stats ─────────────────────────────────────────────── */

/**
 * GET /dashboard/stats
 * @returns {{ label, value, change, trend, color, icon }[]}
 */
export async function getStats() {
  return request('/dashboard/stats');
}

/* ── Orders ─────────────────────────────────────────────── */

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

const dashboardService = { getStats, getRecentOrders, createOrder };
export default dashboardService;
