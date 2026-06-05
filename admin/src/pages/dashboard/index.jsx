// src/pages/Dashboard/index.jsx
import { useState } from 'react';
import './dashboard.css';

import Sidebar              from './components/Sidebar';
import TopBar               from './components/TopBar';
import StatsRow             from './components/StatsRow';
import RevenueChart         from './components/RevenueChart';
import TopClients           from './components/TopClients';
import AlertsCenter         from './components/AlertsCenter';
import PropertyMap          from './components/PropertyMap';
import OccupancyGauge       from './components/OccupancyGauge';
import SubscriptionOverview from './components/SubscriptionOverview';
import RecentActivities     from './components/RecentActivities';
import Modal                from './components/Modal';

import { useStats }    from './hooks/useStats';
import { useAccounts } from './hooks/useAccounts';

export default function Dashboard() {
  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const openModal  = (type, data = null) => setModal({ open: true, type, data });
  const closeModal = ()                  => setModal({ open: false, type: null, data: null });

  // useStats now fetches the full /api/dashboard-overview payload.
  // `overview` contains everything: revenue chart, top clients,
  // occupancy breakdown, alerts, recent activities — all from Smoobu.
  const { stats, overview, loading: statsLoading } = useStats();

  // useAccounts still fetches clients + staffs from the DB (for DashboardCharts).
  const { accounts, loading: accountsLoading } = useAccounts();

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar onAction={() => openModal('create')} />

        <div className="db-content">

          {/* ── Header ── */}
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Overview</h1>
              <p className="db-content__sub">Welcome back, Admin</p>
            </div>
            {/* Period badge — shows what date range the KPIs cover */}
            {overview?.period && (
              <div style={{
                fontSize: '.75rem',
                color: 'var(--color-muted)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 12px',
                alignSelf: 'center',
              }}>
                {overview.period.from} → {overview.period.to}
              </div>
            )}
          </header>

          {/* ── Row 1+2: Stats + Chart | Top Clients ── */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatsRow stats={stats} loading={statsLoading} />
              {/* Pass real chart data from Smoobu; falls back to static mock if null */}
              <RevenueChart smoobuChartData={overview?.revenueChart ?? null} />
            </div>
            <div style={{ width: 420, flexShrink: 0, alignSelf: 'stretch' }}>
              {/* TopClients receives live data ranked by Smoobu revenue */}
              <TopClients
                topClients={overview?.topClients ?? null}
                loading={statsLoading}
              />
            </div>
          </div>

          {/* ── Row 3: Property Map + Occupancy Gauge ── */}
          <div className="db-grid-2">
            <PropertyMap />
            {/* OccupancyGauge receives live per-property occupancy from Smoobu */}
            <OccupancyGauge
              occupancyBreakdown={overview?.occupancyBreakdown ?? null}
              overallOccupancy={overview?.overallOccupancy ?? null}
              loading={statsLoading}
            />
          </div>

          {/* ── Row 4: Alerts Center + Recent Activities ── */}
          <div className="db-grid-2">
            {/* AlertsCenter receives auto-generated alerts from Smoobu data */}
            <AlertsCenter
              alerts={overview?.alerts ?? null}
              loading={statsLoading}
            />
            {/* RecentActivities receives real booking/cancellation activity */}
            <RecentActivities
              activities={overview?.recentActivities ?? null}
              loading={statsLoading}
            />
          </div>

        </div>
      </div>

      {modal.open && (
        <Modal type={modal.type} data={modal.data} onClose={closeModal} />
      )}
    </div>
  );
}