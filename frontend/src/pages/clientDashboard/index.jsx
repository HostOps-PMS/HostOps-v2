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
import FirstLoginPinModal from "./components/FirstLoginPinModal";
import { useDashboard } from "./context/DashboardContext";
import { useDashboardData } from "./hooks/useDashboardData";
import Footer from "./components/Footer";
import ProfitabilityCalculator from "./components/ProfitabilityCalculator";
import safeStorage from "../safeStorage";
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
      safeStorage.setItem('hp_user', JSON.stringify(updatedUser));
    }
    setShowFirstLoginModal(false);
  };

  const [showFirstLoginPinModal, setShowFirstLoginPinModal] = useState(() => {
    return sessionStorage.getItem('hp_must_change_pin') === 'true';
  });

  const handlePinChanged = (updatedUser) => {
    if (updatedUser) {
      safeStorage.setItem('hp_user', JSON.stringify(updatedUser));
    }
    setShowFirstLoginPinModal(false);
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
const [profitOpen, setProfitOpen] = useState(false);
console.log("profitOpen:", profitOpen);

  // Message modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalListMode, setModalListMode] = useState(false);
  const [modalReservationId, setModalReservationId] = useState(null);
  const [modalThread, setModalThread] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch whenever the user switches property.
  // No overrides needed — sessionStorage (hp_selected_property_id) is already
  // updated by selectProperty() before this effect fires, so loadData() reads
  // the correct propertyDbId from sessionStorage internally.
  // The ref guard prevents a double-fetch on initial mount.
  const prevPropertyIdRef = React.useRef('__INIT__');
  useEffect(() => {
    if (prevPropertyIdRef.current === '__INIT__') {
      prevPropertyIdRef.current = dashState.selectedPropertyId;
      return;
    }
    if (prevPropertyIdRef.current === dashState.selectedPropertyId) return;
    prevPropertyIdRef.current = dashState.selectedPropertyId;
    loadData();
  }, [dashState.selectedPropertyId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Title: if a specific property is selected, show its name; otherwise fall
  // back to the owner name from the API response, then a generic default.
  const ownerName = dashState.selectedPropertyName || data.ownerName || 'Dashboard';

  return (
    <div style={{ background: "#f4f6f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* First-login modal: blocking overlay shown until password is set */}
      {showFirstLoginModal && (
        <FirstLoginModal onComplete={handlePasswordChanged} />
      )}
      {/* First-login PIN modal: blocking overlay shown until PIN is set */}
      {showFirstLoginPinModal && !showFirstLoginModal && (
        <FirstLoginPinModal onComplete={handlePinChanged} />
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
      <style>{`
        @keyframes fabPulse {
          0% { box-shadow: 0 0 0 0 rgba(30,135,96,0.5), 0 4px 20px rgba(0,0,0,0.25); }
          70% { box-shadow: 0 0 0 10px rgba(30,135,96,0), 0 4px 20px rgba(0,0,0,0.25); }
          100% { box-shadow: 0 0 0 0 rgba(30,135,96,0), 0 4px 20px rgba(0,0,0,0.25); }
        }
      `}</style>

      <style>{`
        @media (max-width: 768px) {
          .db-container {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          .db-page-header {
            flex-direction: column !important;
            gap: 10px !important;
            margin-bottom: 16px !important;
          }
          .db-page-header h1 {
            font-size: 1.35rem !important;
          }
          .db-page-header p {
            font-size: .78rem !important;
          }
          .db-date-filter {
            width: 100% !important;
            padding-top: 0 !important;
          }
          .db-date-filter > * {
            width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .db-container {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .db-page-header h1 {
            font-size: 1.2rem !important;
          }
        }

        /* ── DateFilterBar: force full width + wrap on mobile ── */
        @media (max-width: 768px) {
          .db-date-filter {
            width: 100% !important;
          }
          /* pill button group */
          .db-date-filter > div,
          .db-date-filter form,
          .db-date-filter nav {
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          /* each pill button */
          .db-date-filter button {
            flex: 1 !important;
            min-width: 60px !important;
            font-size: .72rem !important;
            padding: 6px 8px !important;
            text-align: center !important;
            justify-content: center !important;
          }
          /* custom date popover: full width */
          .db-date-filter [style*="position: absolute"],
          .db-date-filter [style*="position:absolute"] {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 90vw !important;
            max-width: 320px !important;
            z-index: 9999 !important;
          }
        }
      `}</style>
      <div style={{ background: dark ? "#0c1c14" : "#f7faf8", transition: "background 0.2s", flex: 1 }}>
        {/* ── Normal dashboard — always rendered regardless of Smoobu connection state ── */}
        <>
          <div className="db-container">
            {/* ── Page header: title LEFT, date filter RIGHT ── */}
            <div className="db-page-header" style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 28,
            }}>
              {/* Title + property badge */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontFamily: "'Sora',sans-serif",
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#0c1c14',
                    margin: '0 0 4px',
                  }}>
                    {ownerName}
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ color: '#9ab8a9', fontSize: '.88rem', margin: 0 }}>
                    Your portfolio at a glance
                  </p>
                </div>
              </div>

              {/* Date filter toggle — placed top-right as circled in screenshot */}
              <div className="db-date-filter" style={{ paddingTop: 4 }}>
                <DateFilterBar />
              </div>
            </div>

            {/* KPI cards */}
            <StatCards stats={stats} />

              {/* Availability Calendar */}
              <CalendarSection />
            </div>
          </>
      </div>

      <button
        onClick={() => setProfitOpen(true)}
        onMouseEnter={e => { if (window.innerWidth > 768) e.currentTarget.style.transform = "translateX(0)"; }}
        onMouseLeave={e => { if (window.innerWidth > 768) e.currentTarget.style.transform = "translateX(calc(100% - 48px))"; }}
        title="Profitability Calculator"
        aria-label="Open Profitability Calculator"
        style={{
          position: "fixed",
          bottom: window.innerWidth <= 768 ? 0 : 120,
          right: 0,
          zIndex: 999,
          background: "#1e8760",
          border: "none",
          borderRadius: window.innerWidth <= 768 ? "16px 0 0 0" : "999px 0 0 999px",
          padding: window.innerWidth <= 768 ? "10px 18px 14px 16px" : "0 16px 0 12px",
          height: window.innerWidth <= 768 ? "auto" : 44,
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          transform: window.innerWidth <= 768 ? "none" : "translateX(calc(100% - 48px))",
          transition: "transform 0.3s ease",
          boxShadow: "-4px -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <i className="ti ti-calculator" style={{ fontSize: 18, color: "#fff" }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>OPEN</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>Profitability</span>
        </div>
      </button>

      {profitOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setProfitOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12,28,20,0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(8px, 4vw, 20px)",
          }}
        >
          <div style={{
            width: "min(720px, 96vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            borderRadius: 20,
            boxShadow: "0 24px 64px rgba(12,28,20,0.2)",
            position: "relative",
          }}>
            {/* X button — fixed sa loob ng modal, hindi nag-scroll */}
            <button
              onClick={() => setProfitOpen(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 35,
                right: 20,
                zIndex: 20,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #e0ede6",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6a8b7c",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              <i className="ti ti-x" />
            </button>
            <ProfitabilityCalculator
              dark={dark}
              stats={stats}
              period={period}
            />
          </div>
        </div>
      )}

      <Footer />

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
