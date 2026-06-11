// src/pages/Dashboard/index.jsx
import { useState } from 'react';
import './dashboard.css';

import { exportDashboardPdf } from './utils/exportDashboardPdf';

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

  const getPresetRange = (preset) => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (preset === 'daily')   return { from: fmt(today), to: fmt(today) };
    if (preset === 'weekly')  { const s = new Date(today); s.setDate(today.getDate() - 6); return { from: fmt(s), to: fmt(today) }; }
    if (preset === 'monthly') return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
    if (preset === 'yearly')  return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(new Date(today.getFullYear(), 11, 31)) };
    return { from: '', to: '' };
  };

  const [dateRange,     setDateRange]     = useState(() => getPresetRange('monthly'));
  const [appliedRange,  setAppliedRange]  = useState(() => getPresetRange('monthly'));
  const [activePreset,  setActivePreset]  = useState('monthly');

  const applyPreset = (preset) => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let from, to;
    if (preset === 'daily') {
      from = to = fmt(today);
    } else if (preset === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      from = fmt(start); to = fmt(today);
    } else if (preset === 'monthly') {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      to   = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    } else if (preset === 'yearly') {
      from = fmt(new Date(today.getFullYear(), 0, 1));
      to   = fmt(new Date(today.getFullYear(), 11, 31));
    }
    setActivePreset(preset);
    setDateRange({ from, to });
    setAppliedRange({ from, to });
  };

  const openModal  = (type, data = null) => setModal({ open: true, type, data });
  const closeModal = ()                  => setModal({ open: false, type: null, data: null });

  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (exportLoading || statsLoading) return;
    setExportLoading(true);
    try {
      await exportDashboardPdf({ overview, stats, appliedRange });
    } catch (err) {
      console.error('[exportDashboardPdf] failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  // useStats fetches the full /api/dashboard-overview payload.
  const { stats, overview, loading: statsLoading } = useStats(appliedRange);

  // useAccounts fetches clients + staffs from the DB.
  const { accounts, loading: accountsLoading } = useAccounts();

  return (
    <div className="db-layout">
      <Sidebar
        onExport={handleExport}
        exportLoading={exportLoading || statsLoading}
        alerts={overview?.alerts ?? []}
      />

      <div className="db-main">
        {/*
          Pass alerts + recentActivities from the overview payload so the
          notification bell in the TopBar can display them in the dropdown.
          `notifLoading` mirrors the same loading state so the dropdown
          can show a spinner while data is being fetched.
        */}
        <TopBar
          onAction={() => openModal('create')}
          onExport={handleExport}
          exportLoading={exportLoading || statsLoading}
          alerts={overview?.alerts ?? []}
          activities={overview?.recentActivities ?? []}
          notifLoading={statsLoading}
        />

        <div className="db-content">

          {/* ── Header ── */}
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Overview</h1>
              <p className="db-content__sub">Welcome back, Admin</p>
            </div>

            {/* Date range filter */}
            <div className="db-date-filter">
              <div className="db-date-filter__presets-row">
                {['daily','weekly','monthly','yearly'].map(p => (
                  <button
                    key={p}
                    className={`db-date-filter__preset${activePreset === p ? ' db-date-filter__preset--active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="db-date-filter__divider" />
              <div className="db-date-filter__dates-row">
                <label className="db-date-filter__label">From</label>
                <input
                  type="date"
                  className="db-date-filter__input"
                  value={dateRange.from}
                  onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
                <span className="db-date-filter__arrow">→</span>
                <label className="db-date-filter__label">To</label>
                <input
                  type="date"
                  className="db-date-filter__input"
                  value={dateRange.to}
                  onChange={e => {
                    setDateRange(prev => ({ ...prev, to: e.target.value }));
                    setActivePreset('custom');
                  }}
                />
              </div>
              <button
                className="db-date-filter__btn"
                onClick={() => setAppliedRange({ ...dateRange })}
              >
                Apply
              </button>
            </div>
          </header>

          {/* ── Row 1+2: Stats + Chart | Top Clients ── */}
          <div className="db-dashboard-row">
            <div className="db-dashboard-row__main">
              <StatsRow stats={stats} loading={statsLoading} />
              <RevenueChart smoobuChartData={overview?.revenueChart ?? null} />
            </div>
            <div className="db-dashboard-row__side">
              <TopClients
                topClients={overview?.topClients ?? null}
                loading={statsLoading}
              />
            </div>
          </div>

          {/* ── Row 3: Property Map + Occupancy Gauge ── */}
          <div className="db-grid-2">
            <PropertyMap
              mapLocations={overview?.mapLocations ?? null}
              loading={statsLoading}
            />
            <OccupancyGauge
              occupancyBreakdown={overview?.occupancyBreakdown ?? null}
              overallOccupancy={overview?.overallOccupancy ?? null}
              loading={statsLoading}
            />
          </div>

          {/* ── Row 4: Alerts Center + Recent Activities ── */}
          <div className="db-grid-2">
            <AlertsCenter
              alerts={overview?.alerts ?? null}
              loading={statsLoading}
            />
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