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

import { useStats }  from './hooks/useStats';

export default function Dashboard() {
  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const openModal  = (type, data = null) => setModal({ open: true, type, data });
  const closeModal = ()                  => setModal({ open: false, type: null, data: null });

  const { stats, loading: statsLoading }   = useStats();

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
          </header>

          {/* ── Row 1+2: Stats + Chart | Top Clients ── */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatsRow stats={stats} loading={statsLoading} />
              <RevenueChart />
            </div>
            <div style={{ width: 420, flexShrink: 0, alignSelf: 'stretch' }}>
              <TopClients />
            </div>
          </div>

          {/* ── Row 3: Property Map + Occupancy Gauge ── */}
          <div className="db-grid-2">
            <PropertyMap />
            <OccupancyGauge />
          </div>

          {/* ── Row 4: Alerts Center + Recent Activities ── */}
          <div className="db-grid-2">
            <AlertsCenter />
            <RecentActivities />
          </div>

        </div>
      </div>

      {modal.open && (
        <Modal type={modal.type} data={modal.data} onClose={closeModal} />
      )}
    </div>
  );
}