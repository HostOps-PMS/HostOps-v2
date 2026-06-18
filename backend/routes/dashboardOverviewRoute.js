// src/routes/dashboardOverviewRoute.js
// ─────────────────────────────────────────────────────────────────
// Admin dashboard overview route.
//
// Mount in server.js:
//   import dashboardOverviewRoute from './routes/dashboardOverviewRoute.js';
//   app.use('/api', dashboardOverviewRoute);
//
// Endpoints:
//   GET /api/dashboard-overview
//   GET /api/dashboard-overview?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Requires: valid Bearer token AND admin role.
// ─────────────────────────────────────────────────────────────────

import express             from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getDashboardOverview }       from '../services/dashboardOverview.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// GET /api/dashboard-overview
//
// Returns the aggregated admin dashboard payload.
//
// Optional query params:
//   ?from=YYYY-MM-DD   — start of the stats period (default: 1st of current month)
//   ?to=YYYY-MM-DD     — end of the stats period   (default: last day of current month)
//
// The chart data always covers the trailing 12 months regardless of
// the from/to params, so the RevenueChart always has a meaningful trend.
//
// Response shape:
// {
//   totalClients:         number,
//   totalProperties:      number,
//   monthlyRevenue:       number,
//   totalBookings:        number,
//   totalCancellations:   number,
//   overallOccupancy:     number,          // 0–100
//   period:               { from, to },
//   revenueChart:         [{ month, label, revenue, bookings, cancellations }],
//   topClients:           [{ rank, clientId, clientName, revenue, bookings, properties[] }],
//   occupancyBreakdown:   [{ propertyName, clientName, occupancy }],
//   recentBookings:       [{ reservationId, guestName, channel, arrival, departure, price, nights, propertyName, clientName }],
//   recentCancellations:  [{ reservationId, guestName, channel, arrival, nights, propertyName, clientName }],
//   alerts:               [{ id, type, title, desc, time, unread, avatar, avatarBg, clientId, clientName }],
//   recentActivities:     [{ id, type, actor, action, target, time, avatar }],
//   byChannel:            { [channelName]: { revenue, bookings, nights } },
//   fetchedAt:            string,          // ISO timestamp
//   connectedProperties:  number,          // how many properties had a Smoobu key
// }
// ─────────────────────────────────────────────────────────────────
router.post(
  '/dashboard-overview',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { from, to } = req.body;

      // Basic date format validation (YYYY-MM-DD) if supplied
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      if (from && !ISO_DATE.test(from)) {
        return res.status(400).json({ error: '`from` must be in YYYY-MM-DD format.' });
      }
      if (to && !ISO_DATE.test(to)) {
        return res.status(400).json({ error: '`to` must be in YYYY-MM-DD format.' });
      }
      if (from && to && from > to) {
        return res.status(400).json({ error: '`from` cannot be after `to`.' });
      }

      const payload = await getDashboardOverview({ from, to });

      res.json(payload);
    } catch (err) {
      // If a Smoobu key error bubbles up (shouldn't — it's caught per-property)
      if (err.code === 'NO_SMOOBU_KEY') {
        return res.status(200).json({
          smoobuNotConnected: true,
          message: err.message,
        });
      }
      next(err);
    }
  }
);

export default router;
