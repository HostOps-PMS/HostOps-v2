import { useState } from 'react';
import './dashboard.css';

import Sidebar              from './components/Sidebar';
import TopBar               from './components/TopBar';
import StatsRow             from './components/StatsRow';
import RevenueChart         from './components/RevenueChart';
import TopClients           from './components/TopClients';
import AlertsCenter         from './components/AlertsCenter';
import SubscriptionOverview from './components/SubscriptionOverview';
import RecentActivities     from './components/RecentActivities';
import Modal                from './components/Modal';

import { useStats }  from './hooks/useStats';
import { useOrders } from './hooks/useOrders';

export default function Dashboard() {
  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const openModal  = (type, data = null) => setModal({ open: true, type, data });
  const closeModal = ()                  => setModal({ open: false, type: null, data: null });

  const { stats, loading: statsLoading }   = useStats();
  const { orders, loading: ordersLoading } = useOrders();

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

          {/* ── Row 1: Stats with sparklines ── */}
          <StatsRow stats={stats} loading={statsLoading} />

          {/* ── Row 2: Revenue Chart (wider) + Alerts ── */}
          <div className="db-grid-2-wide">
            <RevenueChart />
            <AlertsCenter />
          </div>

          {/* ── Row 3: Top Clients + Subscription Overview ── */}
          <div className="db-grid-2">
            <TopClients />
          </div>

          {/* ── Row 4: Recent Activities (full width) ── */}
          <RecentActivities />

        </div>
      </div>

      {modal.open && (
        <Modal type={modal.type} data={modal.data} onClose={closeModal} />
      )}
    </div>
  );
}