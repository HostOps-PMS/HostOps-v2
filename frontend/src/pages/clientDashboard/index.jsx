import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Banner from './components/Banner';
import StatCards from './components/StatCards';
import RevenueChart from './components/RevenueChart';
import PlatformBreakdown from './components/PlatformBreakdown';
import CalendarSection from './components/CalendarSection';
import UnifiedInbox from './components/UnifiedInbox';
import ActivityFeed from './components/ActivityFeed';
import MessageModal from './components/MessageModal';
import { useDashboard } from './context/DashboardContext';
import { useDashboardData } from './hooks/useDashboardData';
import './globals.css';
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Sora:wght@700;800&display=swap" rel="stylesheet" />

export default function DashboardPage() {
  const { dashState } = useDashboard();
  const { loadData, banner } = useDashboardData();

  // Message modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalListMode, setModalListMode] = useState(false);
  const [modalReservationId, setModalReservationId] = useState(null);
  const [modalThread, setModalThread] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleThreadClick(reservationId, threadInfo, listMode = false) {
    setModalListMode(listMode);
    setModalReservationId(reservationId);
    setModalThread(threadInfo);
    setModalOpen(true);
  }

  function handleSelectThread(reservationId, threadInfo) {
    setModalListMode(false);
    setModalReservationId(reservationId);
    setModalThread(threadInfo);
  }

  const data = dashState.rawData || {};
  const stats = data.stats || {};
  const inbox = data.inbox || [];
  const totalUnread = data.totalUnread || 0;
  const bookings = data.bookings || [];
  const byChannel = data.byChannel || {};
  const period = data.period || {};

  const ownerName = data.ownerName || 'Dashboard';

  return (
    <div>
      <Navbar onBackClick={() => window.history.back()} />
      <Banner type={banner.type} message={banner.message} />

      <div style={{ background: '#f7faf8', minHeight: '100vh' }}>
        <div className="db-demo-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Live Data Dashboard
        </div>

        <div className="db-container">
          {/* Page title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: '1.75rem', fontWeight: 800, color: '#0c1c14', margin: '0 0 4px' }}>
              {ownerName}
            </h1>
            <p style={{ color: '#9ab8a9', fontSize: '.88rem', margin: 0 }}>Your portfolio at a glance</p>
          </div>

          {/* KPI cards */}
          <StatCards stats={stats} />

          {/* Chart + Platform breakdown */}
          <div className="db-grid-2-chart">
            <RevenueChart data={data} period={period} />
            <PlatformBreakdown byChannel={byChannel} />
          </div>

          {/* Calendar */}
          <CalendarSection />

          {/* Inbox + Activity Feed */}
          <div className="db-grid-2-bottom">
            <UnifiedInbox
              inbox={inbox}
              totalUnread={totalUnread}
              onThreadClick={handleThreadClick}
            />
            <ActivityFeed bookings={bookings} channels={dashState.channels} />
          </div>

          {/* CTA */}
          <div className="cta-bottom">
            <div className="cta-bottom-title">Ready to see this with your real data?</div>
            <div className="cta-bottom-sub">Our team will set up your properties and start managing operations within days.</div>
            <div className="cta-btns">
              <button className="cta-btn-primary">Start Setup →</button>
              <button className="cta-btn-secondary">Book a Quick Walkthrough</button>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '24px 0 0', color: '#c5d8cd', fontSize: '.75rem' }}>
            © 2026 HostOps. All rights reserved.
          </div>
        </div>
      </div>

      {/* Message reply modal */}
      <MessageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reservationId={modalReservationId}
        threadInfo={modalThread}
        inbox={inbox}
        listMode={modalListMode}
        onSelectThread={handleSelectThread}
      />
    </div>
  );
}