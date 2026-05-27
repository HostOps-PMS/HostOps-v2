import { useState } from 'react';
import './dashboard.css';

import Sidebar     from './components/Sidebar';
import TopBar      from './components/TopBar';
import StatsRow    from './components/StatsRow';
import RecentTable from './components/RecentTable';
import Modal       from './components/Modal';

import { useStats }  from './hooks/useStats';
import { useOrders } from './hooks/useOrders';

export default function Dashboard() {
  /* ── modal state ── */
  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const openModal  = (type, data = null) => setModal({ open: true, type, data });
  const closeModal = ()                  => setModal({ open: false, type: null, data: null });

  /* ── data ── */
  const { stats, loading: statsLoading }   = useStats();
  const { orders, loading: ordersLoading } = useOrders();

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar onAction={() => openModal('create')} />

        <div className="db-content">
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Overview</h1>
              <p className="db-content__sub">Welcome back, Admin</p>
            </div>
          </header>

          <StatsRow stats={stats} loading={statsLoading} />

          <RecentTable
            orders={orders}
            loading={ordersLoading}
            onRowClick={(row) => openModal('detail', row)}
          />
        </div>
      </div>

      {modal.open && (
        <Modal type={modal.type} data={modal.data} onClose={closeModal} />
      )}
    </div>
  );
}
