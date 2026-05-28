import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Banner from "./components/Banner";
import StatCards from "./components/StatCards";
import RevenueChart from "./components/RevenueChart";
import PlatformBreakdown from "./components/PlatformBreakdown";
import CalendarSection from "./components/CalendarSection";
import UnifiedInbox from "./components/UnifiedInbox";
import ActivityFeed from "./components/ActivityFeed";
import MessageModal from "./components/MessageModal";
import DateFilterBar from "./components/DateFilterBar";
import FirstLoginModal from "./components/FirstLoginModal";
import { useDashboard } from "./context/DashboardContext";
import { useDashboardData } from "./hooks/useDashboardData";
import Footer from "./components/Footer";
import "./globals.css";

export default function DashboardPage() {
  const { dashState, dark } = useDashboard();
  const { loadData, banner } = useDashboardData();

  // ── First-login password change ──────────────────────────────────────────────
  // Set by LoginForm when the backend returns mustChangePassword: true.
  // The modal is shown until the user successfully changes their password,
  // at which point the backend marks the account as verified.
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(() => {
    return sessionStorage.getItem('hp_must_change_password') === 'true';
  });

  const handlePasswordChanged = (updatedUser) => {
    // Store the refreshed user object (now with isVerified: true)
    if (updatedUser) {
      sessionStorage.setItem('hp_user', JSON.stringify(updatedUser));
    }
    setShowFirstLoginModal(false);
  };

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

  return (
    <div style={{ background: "#f4f6f5", minHeight: "100vh" }}>
      {/* First-login modal: blocking overlay shown until password is set */}
      {showFirstLoginModal && (
        <FirstLoginModal onComplete={handlePasswordChanged} />
      )}

      <div style={{ position: "sticky", top: 0, zIndex: 100 }}>
        <Navbar />
        <Banner type={banner.type} message={banner.message} />
        {banner.type === 'live' && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "8px 20px",
            background: "linear-gradient(135deg, #eaf8f1 0%, #f0fdf8 100%)",
            borderBottom: "1px solid #d1f0e3",
            width: "100%",
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1e8760", display: "inline-block", animation: "pulse 2s infinite", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e8760", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Live Data Dashboard
            </span>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1e8760", display: "inline-block", animation: "pulse 2s infinite 1s", flexShrink: 0 }} />
          </div>
        )}
      </div>

      <div style={{ background: dark ? "#0c1c14" : "#f7faf8", transition: "background 0.2s" }}>
        {/* ── Normal dashboard — always rendered regardless of Smoobu connection state ── */}
        <>
          <div className="db-container">
            {/* ── Page header: title LEFT, date filter RIGHT ── */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 28,
            }}>
              {/* Title */}
              <div>
                <h1 style={{
                  fontFamily: "'Sora',sans-serif",
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: '#0c1c14',
                  margin: '0 0 4px',
                }}>
                  {ownerName}
                </h1>
                <p style={{ color: '#9ab8a9', fontSize: '.88rem', margin: 0 }}>
                  Your portfolio at a glance
                </p>
              </div>

              {/* Date filter toggle — placed top-right as circled in screenshot */}
              <div style={{ paddingTop: 4 }}>
                <DateFilterBar />
              </div>
            </div>

            {/* KPI cards */}
            <StatCards stats={stats} />

              {/* Inbox + Activity Feed */}
              <div className="db-grid-2-bottom">
                <UnifiedInbox
                  inbox={inbox}
                  totalUnread={totalUnread}
                  onThreadClick={handleThreadClick}
                />
                {/* <ActivityFeed bookings={bookings} channels={dashState.channels} /> */}
              </div>
            </div>
 
            <Footer />
          </>
        
      </div>

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