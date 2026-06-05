import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { logoutUser } from '../../Login/services/authservice';
import { useDashboard } from "../context/DashboardContext";
import { exportDashboardPDF } from "../services/pdfExportService";
import AccountSettingsModal from "./AccountSettingsModal";
import { useActivityLog } from "../hooks/useActivityLog";

export default function Navbar() {
  const { getUser, clear } = useAuth();
  const { dashState, dark, setDark, selectProperty } = useDashboard();
  const user = getUser();
  const [dropOpen, setDropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const notifRefMobile = useRef(null);
  const prevBookingIdsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function playNotifSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      master.connect(ctx.destination);

      // First tone — higher pitch ding
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(880, ctx.currentTime);
      o1.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08);
      g1.gain.setValueAtTime(0.5, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o1.connect(g1);
      g1.connect(master);
      o1.start(ctx.currentTime);
      o1.stop(ctx.currentTime + 0.5);

      // Second tone — lower follow-up
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      o2.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.22);
      g2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.14);
      g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
      o2.connect(g2);
      g2.connect(master);
      o2.start(ctx.currentTime + 0.12);
      o2.stop(ctx.currentTime + 0.65);

      // Third tone — high finish
      const o3 = ctx.createOscillator();
      const g3 = ctx.createGain();
      o3.type = 'sine';
      o3.frequency.setValueAtTime(1320, ctx.currentTime + 0.28);
      o3.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.5);
      g3.gain.setValueAtTime(0.0001, ctx.currentTime + 0.28);
      g3.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.30);
      g3.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.75);
      o3.connect(g3);
      g3.connect(master);
      o3.start(ctx.currentTime + 0.28);
      o3.stop(ctx.currentTime + 0.75);

      setTimeout(() => ctx.close(), 1200);
    } catch (e) {
      console.warn('Audio notification failed:', e);
    }
  }

  useEffect(() => {
    const bookings = dashState?.rawData?.bookings;
    if (!bookings) return;

    const activeBookings = bookings
      .filter((b) => !b['is-blocked-booking'] && b.type !== 'cancellation')
      .sort((a, b) => new Date(b['created-at'] || b.createdAt || 0) - new Date(a['created-at'] || a.createdAt || 0));

    const currentIds = new Set(activeBookings.map((b) => b.id));

    // First load — populate with 3 most recent bookings (same as ActivityFeed)
    if (prevBookingIdsRef.current === null) {
      prevBookingIdsRef.current = currentIds;
      const initial = activeBookings.slice(0, 5).map((b) => ({
        id:       b.id,
        guest:    b['guest-name'] || b.firstname || 'Guest',
        property: b.apartment?.name || b.apartmentName || 'Property',
        price:    b.price || b.amount || 0,
        arrival:  b.arrival || b.checkIn || '',
        channel:  (b.channel && b.channel.name) || (typeof b.channel === 'string' ? b.channel : '') || 'Direct',
        time:     new Date(b['created-at'] || b.createdAt || Date.now()),
        read:     true,
      }));
      setNotifications(initial);
      return;
    }

    // Subsequent updates — detect truly new bookings and play sound
    const newBookings = activeBookings.filter(
      (b) => !prevBookingIdsRef.current.has(b.id)
    );

    if (newBookings.length > 0) {
      playNotifSound();
      const newNotifs = newBookings.map((b) => ({
        id:       b.id,
        guest:    b['guest-name'] || b.firstname || 'Guest',
        property: b.apartment?.name || b.apartmentName || 'Property',
        price:    b.price || b.amount || 0,
        arrival:  b.arrival || b.checkIn || '',
        channel:  (b.channel && b.channel.name) || (typeof b.channel === 'string' ? b.channel : '') || 'Direct',
        time:     new Date(b['created-at'] || b.createdAt || Date.now()),
        read:     false,
      }));
      setNotifications((prev) => [...newNotifs, ...prev]);
      setUnreadCount((prev) => prev + newBookings.length);
    }

    prevBookingIdsRef.current = currentIds;
  }, [dashState?.rawData?.bookings]);

  useEffect(() => {
    function handleClickOutside(e) {
      const inDesktop = notifRef.current && notifRef.current.contains(e.target);
      const inMobile  = notifRefMobile.current && notifRefMobile.current.contains(e.target);
      if (!inDesktop && !inMobile) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    clear();
    window.location.href = "/";
  };

  const { logActivity } = useActivityLog();

  function openAccountSettings() {
    setDropOpen(false);
    setMenuOpen(false);
    setAccountSettingsOpen(true);
    logActivity('opened_account_settings');
  }

  async function handleExportPDF() {
    if (isExporting) return;
    logActivity('exported_pdf');
    if (!dashState.rawData) {
      alert("No dashboard data loaded yet. Please wait for data to load first.");
      return;
    }
    setIsExporting(true);
    try {
      // Small tick so the spinner renders before the heavy PDF work blocks the thread
      await new Promise((r) => setTimeout(r, 50));
      await exportDashboardPDF(dashState);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  const t = {
    navbar: {
      background: dark ? "#0c1c14" : "#eaf5f0",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      transition: "background 0.2s, border-color 0.2s",
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    inner: {
      maxWidth: "1400px",
      margin: "0 auto",
      padding: isMobile ? "0 16px" : "0 32px",
      height: isMobile ? "52px" : "58px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logoWrap: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      textDecoration: "none",
    },
    logoBox: {
      width: "28px",
      height: "28px",
      background: dark ? "#eaf5f0" : "#0c1c14",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    logoIcon: {
      fontSize: "14px",
      color: dark ? "#0c1c14" : "#eaf5f0",
    },
    logoText: {
      fontSize: "17px",
      fontWeight: 700,
      color: dark ? "#eaf5f0" : "#0c1c14",
      letterSpacing: "-0.3px",
    },
    rightGroup: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    iconBtn: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      background: "transparent",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: dark ? "#56c299" : "#1e8760",
    },
    exportBtn: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      background: isExporting
        ? (dark ? "#1a2e20" : "#eaf8f1")
        : "transparent",
      border: `0.5px solid ${isExporting ? "#26a676" : (dark ? "#1e3a2a" : "#b7dece")}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: isExporting ? "default" : "pointer",
      color: isExporting ? "#26a676" : (dark ? "#56c299" : "#1e8760"),
      transition: "all .15s",
      position: "relative",
    },
    iconBtnIcon: { fontSize: "16px" },
    divider: {
      width: "0.5px",
      height: "20px",
      background: dark ? "#1e3a2a" : "#b7dece",
      margin: "0 4px",
    },
    userPill: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 10px",
      borderRadius: "8px",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      cursor: "pointer",
      background: dark ? "#1a2e20" : "#fff",
    },
    avatar: {
      width: "26px",
      height: "26px",
      borderRadius: "50%",
      background: dark ? "#56c299" : "#0c1c14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      fontWeight: 500,
      color: dark ? "#0c1c14" : "#eaf5f0",
      flexShrink: 0,
    },
    userName: {
      fontSize: "13px",
      fontWeight: 500,
      color: dark ? "#eaf5f0" : "#0c1c14",
    },
    chevron: {
      fontSize: "13px",
      color: dark ? "#56c299" : "#1e8760",
      transition: "transform 0.2s",
      transform: dropOpen ? "rotate(180deg)" : "rotate(0deg)",
    },
    dropdown: {
      display: dropOpen ? "block" : "none",
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      width: "200px",
      background: dark ? "#1a2e20" : "#fff",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      borderRadius: "10px",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      zIndex: 999,
    },
    dropHeader: {
      padding: "12px 14px",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#e8f3ee"}`,
    },
    dropName: {
      fontSize: "13px",
      fontWeight: 500,
      color: dark ? "#eaf5f0" : "#0c1c14",
      margin: 0,
    },
    dropEmail: {
      fontSize: "11px",
      color: dark ? "#56c299" : "#6a8b7c",
      margin: "3px 0 0",
    },
    dropBody: { padding: "6px" },
    dropBtn: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "9px 10px",
      borderRadius: "6px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      textAlign: "left",
    },
    mobileMenu: {
      display: menuOpen ? "flex" : "none",
      flexDirection: "column",
      position: "absolute",
      top: "52px",
      left: 0,
      right: 0,
      background: dark ? "#0c1c14" : "#eaf5f0",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      padding: "12px 16px",
      gap: "8px",
      zIndex: 99,
    },
    mobileMenuItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "8px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      width: "100%",
      textAlign: "left",
    },
    mobileDivider: {
      height: "0.5px",
      background: dark ? "#1e3a2a" : "#b7dece",
      margin: "4px 0",
    },
  };

  /* ── Export button (shared between mobile & desktop) ── */
  const ExportButton = (
    <button
      style={t.exportBtn}
      onClick={handleExportPDF}
      aria-label={isExporting ? "Exporting PDF…" : "Export analytics as PDF"}
      title={
        isExporting
          ? "Generating PDF…"
          : `Export analytics PDF${dashState.from ? ` · ${dashState.from} – ${dashState.to}` : ""}`
      }
    >
      {isExporting ? (
        /* Spinning ring */
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: "spin 0.8s linear infinite" }}
        >
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        /* Download arrow icon */
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <nav style={{ ...t.navbar, position: "sticky" }}>
          <div style={t.inner}>
            {/* FIX: Link to /dashboard not / — clicking the logo on /inbox
                was navigating to LoginPage which redirected back to /inbox,
                making it impossible to get back to /dashboard from the logo. */}
            <Link to="/dashboard" style={t.logoWrap}>
              <div style={t.logoBox}>
                <i className="ti ti-home" style={t.logoIcon} aria-hidden="true" />
              </div>
              <span style={t.logoText}>HostOps</span>
            </Link>

            <div style={t.rightGroup}>

              <div style={{ position: 'relative' }} ref={notifRefMobile}>
                <button
                  style={{ ...t.iconBtn, position: 'relative' }}
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((p) => !p)}
                >
                  <i className="ti ti-bell" style={t.iconBtnIcon} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#e74c3c', border: '1.5px solid',
                      borderColor: dark ? '#0c1c14' : '#eaf5f0',
                      animation: 'notif-pulse 1.2s ease-in-out infinite',
                    }} />
                  )}
                </button>
                {notifOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: '290px', background: dark ? '#1a2e20' : '#fff',
                    border: `1px solid ${dark ? '#1e3a2a' : '#d4eddf'}`,
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                    zIndex: 999, overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '14px 16px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#e8f5ee'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: dark ? '#eaf5f0' : '#0c1c14' }}>
                        Notifications
                      </span>
                      {notifications.length > 0 && (
                        <button onClick={() => { setUnreadCount(0); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); }} style={{
                          fontSize: '11px', color: '#26a676', background: 'none',
                          border: 'none', cursor: 'pointer', fontWeight: 500,
                        }}>
                          Read All
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9ab8a9', fontSize: '13px' }}>
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={n.id || i} style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f9f4'}`,
                            background: n.read ? 'transparent' : (dark ? '#132a1e' : '#f5fdf8'),
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: '#26a676', flexShrink: 0, opacity: n.read ? 0 : 1,
                              }} />
                              <span style={{ fontSize: '12px', fontWeight: 700, color: dark ? '#eaf5f0' : '#0c1c14' }}>
                                New Booking
                              </span>
                              <span style={{ fontSize: '11px', color: '#9ab8a9', marginLeft: 'auto' }}>
                                {n.time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: dark ? '#b0cfc0' : '#3a5a48', paddingLeft: '16px' }}>
                              <strong>{n.guest}</strong> · {n.property}
                            </div>
                            <div style={{ fontSize: '11px', color: '#26a676', paddingLeft: '16px', marginTop: '2px' }}>
                              PHP {Number(n.price || 0).toLocaleString()} · {n.channel}
                            </div>
                            {n.arrival && (
                              <div style={{ fontSize: '11px', color: '#9ab8a9', paddingLeft: '16px', marginTop: '1px' }}>
                                Check-in: {new Date(n.arrival).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Export PDF */}
              {ExportButton}

              <button
                style={t.iconBtn}
                onClick={() => setDark((prev) => !prev)}
                aria-label="Toggle dark mode"
              >
                <i
                  className={dark ? "ti ti-sun" : "ti ti-moon"}
                  style={t.iconBtnIcon}
                  aria-hidden="true"
                />
              </button>

              <div style={{ position: "relative" }} ref={dropdownRef}>
                <div
                  style={t.avatar}
                  onClick={() => setDropOpen((prev) => !prev)}
                >
                  {user?.firstName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div style={t.dropdown}>
                  <div style={t.dropHeader}>
                    <p style={t.dropName}>
                      {user?.firstName} {user?.lastName || ""}
                    </p>
                    <p style={t.dropEmail}>{user?.email || ""}</p>
                  </div>
                  <div style={t.dropBody}>
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                    >
                      <i
                        className="ti ti-bell"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Notifications
                    </button>
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                      onClick={openAccountSettings}
                    >
                      <i
                        className="ti ti-user"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Account settings
                    </button>
                    <div style={t.mobileDivider} />
                    <button
                      style={{ ...t.dropBtn, color: "#c13515" }}
                      onClick={handleLogout}
                    >
                      <i
                        className="ti ti-logout"
                        style={{ fontSize: "15px", color: "#c13515" }}
                        aria-hidden="true"
                      />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <AccountSettingsModal
          isOpen={accountSettingsOpen}
          onClose={() => setAccountSettingsOpen(false)}
          onPropertySwitch={selectProperty}
        />
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <nav style={{ ...t.navbar, position: "sticky", top: 0 }}>
        <div style={t.inner}>
          {/* FIX: Link to /dashboard not / — same as mobile fix above */}
          <Link to="/dashboard" style={t.logoWrap}>
            <div style={t.logoBox}>
              <i className="ti ti-home" style={t.logoIcon} aria-hidden="true" />
            </div>
            <span style={t.logoText}>HostOps</span>
          </Link>

          <div style={t.rightGroup}>
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                style={{ ...t.iconBtn, position: 'relative' }}
                aria-label="Notifications"
                onClick={() => setNotifOpen((p) => !p)}
              >
                <i className="ti ti-bell" style={t.iconBtnIcon} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#e74c3c', border: '1.5px solid',
                    borderColor: dark ? '#0c1c14' : '#eaf5f0',
                    animation: 'notif-pulse 1.2s ease-in-out infinite',
                  }} />
                )}
              </button>
              <style>{`
                @keyframes notif-pulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.4); opacity: 0.7; }
                }
              `}</style>

              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                  width: '320px', background: dark ? '#1a2e20' : '#fff',
                  border: `1px solid ${dark ? '#1e3a2a' : '#d4eddf'}`,
                  borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                  zIndex: 999, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '14px 16px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#e8f5ee'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: dark ? '#eaf5f0' : '#0c1c14' }}>
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button onClick={() => { setUnreadCount(0); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); }} style={{
                        fontSize: '11px', color: '#26a676', background: 'none',
                        border: 'none', cursor: 'pointer', fontWeight: 500,
                      }}>
                        Read all
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ab8a9', fontSize: '13px' }}>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <div key={n.id || i} style={{
                          padding: '12px 16px',
                          borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f9f4'}`,
                          background: n.read ? 'transparent' : (dark ? '#132a1e' : '#f5fdf8'),
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: '#26a676', flexShrink: 0,
                              opacity: n.read ? 0 : 1,
                            }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: dark ? '#eaf5f0' : '#0c1c14' }}>
                              New Booking
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ab8a9', marginLeft: 'auto' }}>
                              {n.time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: dark ? '#b0cfc0' : '#3a5a48', paddingLeft: '16px' }}>
                            <strong>{n.guest}</strong> · {n.property}
                          </div>
                          <div style={{ fontSize: '11px', color: '#26a676', paddingLeft: '16px', marginTop: '2px' }}>
                            PHP {Number(n.price || 0).toLocaleString()} · {n.channel}
                          </div>
                          {n.arrival && (
                            <div style={{ fontSize: '11px', color: '#9ab8a9', paddingLeft: '16px', marginTop: '1px' }}>
                              Check-in: {new Date(n.arrival).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/inbox" style={{ ...t.iconBtn, textDecoration: 'none' }} aria-label="Inbox">
              <i className="ti ti-inbox" style={t.iconBtnIcon} aria-hidden="true" />
            </Link>

            {/* Export PDF — sits right after the bell */}
            {ExportButton}

            <button
              style={t.iconBtn}
              onClick={() => setDark((prev) => !prev)}
              aria-label="Toggle dark mode"
            >
              <i
                className={dark ? "ti ti-sun" : "ti ti-moon"}
                style={t.iconBtnIcon}
                aria-hidden="true"
              />
            </button>

            <div style={t.divider} />

            <div style={{ position: "relative" }} ref={dropdownRef}>
              <div
                style={t.userPill}
                onClick={() => setDropOpen((prev) => !prev)}
              >
                <div style={t.avatar}>
                  {user?.firstName?.charAt(0).toUpperCase() || "U"}
                </div>
                <span style={t.userName}>{user?.firstName || "User"}</span>
                <i
                  className="ti ti-chevron-down"
                  style={t.chevron}
                  aria-hidden="true"
                />
              </div>

              <div style={t.dropdown}>
                <div style={t.dropHeader}>
                  <p style={t.dropName}>
                    {user?.firstName} {user?.lastName || ""}
                  </p>
                  <p style={t.dropEmail}>{user?.email || ""}</p>
                </div>
                <div style={t.dropBody}>
                  <button
                    style={{ ...t.dropBtn, color: dark ? "#eaf5f0" : "#0c1c14" }}
                    onClick={openAccountSettings}
                  >
                    <i
                      className="ti ti-user"
                      style={{ fontSize: "15px", color: "#1e8760" }}
                      aria-hidden="true"
                    />
                    Account settings
                  </button>
                  <button
                    style={{ ...t.dropBtn, color: "#c13515" }}
                    onClick={handleLogout}
                  >
                    <i
                      className="ti ti-logout"
                      style={{ fontSize: "15px", color: "#c13515" }}
                      aria-hidden="true"
                    />
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        onPropertySwitch={selectProperty}
      />
    </>
  );
}