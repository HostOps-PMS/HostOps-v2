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
import PricingModal from './components/PricingModal';
import { useDashboard } from './context/DashboardContext';
import { useDashboardData } from './hooks/useDashboardData';
import './globals.css';
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Sora:wght@700;800&display=swap" rel="stylesheet" />

export default function DashboardPage() {
  const { dashState } = useDashboard();
  const { loadData, banner } = useDashboardData();

  // ── Current logged-in user (for PricingModal pre-fill) ──────────────────────
  // Tries multiple localStorage keys that your auth layer may use.
  // The login response from the backend is: { accessToken, user: { firstName, lastName, email, ... } }
  // So we check both a direct user object AND a wrapped { user: {...} } shape.
  // If you have a useAuth() hook, replace this entire block with:
  //   const { user: currentUser } = useAuth();
  const [currentUser] = useState(() => {
    try {
      // Keys to check, in order of preference
      const CANDIDATE_KEYS = ['hp_user', 'user', 'auth_user', 'currentUser', 'hostpilot_user'];

      for (const key of CANDIDATE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);

        // Shape 1: stored directly as the user object — { firstName, lastName, email, ... }
        if (parsed && (parsed.firstName || parsed.email)) {
          return parsed;
        }

        // Shape 2: stored as { accessToken, user: { firstName, lastName, email, ... } }
        if (parsed && parsed.user && (parsed.user.firstName || parsed.user.email)) {
          return parsed.user;
        }
      }

      return null;
    } catch {
      return null;
    }
  });

  // Pricing modal state
  const [pricingOpen, setPricingOpen] = useState(false);

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

  // Show a dedicated connect prompt when the user has no Smoobu key configured.
  // This replaces the main dashboard body so they aren't staring at empty cards.
  const smoobuNotConnected = banner.type === 'connect';

return (
    <div style={{ background: "#f4f6f5", minHeight: "100vh" }}>
      <Navbar />
      <Banner type={banner.type} message={banner.message} />

      <div style={{ background: '#f7faf8', minHeight: '100vh' }}>
        {smoobuNotConnected ? (
          // ── Smoobu not connected — show a clean connect prompt ──────────────
          <div className="db-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
            <div style={{
              background: '#fff',
              borderRadius: 20,
              padding: '48px 40px',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 4px 32px rgba(38,166,118,.10)',
              textAlign: 'center',
            }}>
              {/* Icon */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#eaf8f1', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>

              <h2 style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0c1c14',
                margin: '0 0 10px',
              }}>
                Connect your Smoobu account
              </h2>

              <p style={{ color: '#6b8f7a', fontSize: '.9rem', lineHeight: 1.6, margin: '0 0 32px' }}>
                To see your live bookings, revenue, and calendar, add your Smoobu API key. You can find it in your Smoobu account under <strong>Settings → API</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a
                  href="/settings/smoobu"
                  style={{
                    display: 'block',
                    padding: '13px 24px',
                    background: '#26a676',
                    color: '#fff',
                    borderRadius: 10,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 700,
                    fontSize: '.9rem',
                    textDecoration: 'none',
                    transition: 'background .15s',
                  }}
                >
                  Add Smoobu API Key →
                </a>

                <a
                  href="https://login.smoobu.com/en/cockpit/settings/api-settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '13px 24px',
                    background: '#f0f5f2',
                    color: '#2a4e3c',
                    borderRadius: 10,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                    fontSize: '.9rem',
                    textDecoration: 'none',
                  }}
                >
                  Open Smoobu API Settings ↗
                </a>
              </div>

              <p style={{ color: '#b0c9bc', fontSize: '.75rem', marginTop: 24 }}>
                Your API key is stored securely and never shared.
              </p>
            </div>
          </div>
        ) : (
          // ── Normal dashboard ─────────────────────────────────────────────────
          <>
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
                  <button className="cta-btn-primary" onClick={() => setPricingOpen(true)}>Start Setup →</button>
                  <button className="cta-btn-secondary">Book a Quick Walkthrough</button>
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '24px 0 0', color: '#c5d8cd', fontSize: '.75rem' }}>
                © 2026 HostOps. All rights reserved.
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pricing modal */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        user={currentUser}
      />

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
