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
import { useDashboard } from "./context/DashboardContext";
import { useDashboardData } from "./hooks/useDashboardData";
import "./globals.css";

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

  const ownerName = data.ownerName || "Dashboard";

return (
    <div style={{ background: "#f4f6f5", minHeight: "100vh" }}>
      <Navbar />
      <Banner type={banner.type} message={banner.message} />

      <div className="db-container" style={{ paddingTop: 32, paddingBottom: 48 }}>

        {/* ── HEADER ROW ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ab8a9", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              Portfolio Overview
            </p>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: "2rem", fontWeight: 800, color: "#0c1c14", margin: 0, lineHeight: 1.1 }}>
              {ownerName}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e3ede8", borderRadius: 10, padding: "8px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 0 2px #bbf7d0" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#0f6e56" }}>Live Data</span>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <StatCards stats={stats} />

        {/* ── MAIN 2-COL: Chart (wide) + Platform (narrow) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginTop: 20 }}>
          <RevenueChart data={data} period={period} />
          <PlatformBreakdown byChannel={byChannel} />
        </div>

        {/* ── CALENDAR FULL WIDTH ── */}
        <div style={{ marginTop: 20 }}>
          <CalendarSection />
        </div>

        {/* ── BOTTOM 2-COL: Inbox + Activity ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
          <UnifiedInbox
            inbox={inbox}
            totalUnread={totalUnread}
            onThreadClick={handleThreadClick}
          />
          <ActivityFeed bookings={bookings} channels={dashState.channels} />
        </div>

        {/* ── CTA ── */}
        <div style={{
          marginTop: 32,
          background: "linear-gradient(135deg, #0f6e56 0%, #0a4f3d 100%)",
          borderRadius: 20, padding: "40px 48px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "'Sora',sans-serif" }}>
              Ready to see this with your real data?
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", maxWidth: 420 }}>
              Our team will set up your properties and start managing operations within days.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <button className="cta-btn-primary" style={{ background: "#fff", color: "#0f6e56", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Start Setup →
            </button>
            <button className="cta-btn-secondary" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "12px 22px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Book a Walkthrough
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "24px 0 0", color: "#c5d8cd", fontSize: ".75rem" }}>
          © 2026 HostOps. All rights reserved.
        </div>
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
