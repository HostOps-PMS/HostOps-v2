import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { logoutUser } from '../../Login/services/authservice';
import { useDashboard } from "../context/DashboardContext";
import { exportDashboardPDF } from "../services/pdfExportService";
import AccountSettingsModal from "./AccountSettingsModal";
import SwitchAccountModal from "./SwitchAccountModal";
import { useActivityLog } from "../hooks/useActivityLog";
import safeStorage from "../../safeStorage";

function getUserData(auth) {
  let fromStore = auth.getUser();
  // Guard against the { user: { …fields } } wrapper that verifySession
  // previously persisted — unwrap so every field is at the top level.
  if (fromStore && fromStore.user && !fromStore.email && typeof fromStore.user === 'object') {
    fromStore = fromStore.user;
  }
  if (fromStore && (fromStore.businessName || fromStore.firstName)) return fromStore;
  try {
    const token = auth.getToken();
    if (!token) return fromStore || {};
    const payload = token.split(".")[1];
    if (!payload) return fromStore || {};
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return { ...(fromStore || {}), ...JSON.parse(atob(normalized)) };
  } catch {
    return fromStore || {};
  }
}

export default function Navbar() {
  const { getUser, clear } = useAuth();
  const { dashState, dark, setDark, selectProperty } = useDashboard();
  const auth = useAuth();         
  const user = getUserData(auth);
  const [dropOpen, setDropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const notifRefMobile = useRef(null);
  const prevBookingIdsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const isStaffUser = user?.isStaff || user?.role === "staff";
  const personName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const displayName = isStaffUser
    ? personName || "Staff"
    : user?.businessName || "Client";
  const avatarInitial = displayName.charAt(0).toUpperCase();

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

  const handleLogout = () => {
    setDropOpen(false);
    setMenuOpen(false);
    setLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    // Log logout before clearing session — the token is still valid here.
    // Fire-and-forget; never block logout on log failure.
    try {
      logActivity('logout', {
        propertyId:   safeStorage.getItem('hp_selected_property_id')   || null,
        propertyName: safeStorage.getItem('hp_selected_property_name') || null,
      });
    } catch { /* ignore */ }
    await logoutUser();
    clear();
    window.location.href = "/";
  };

  const cancelLogout = () => {
    if (isLoggingOut) return;
    setLogoutModalOpen(false);
  };

  const { logActivity } = useActivityLog();

  function openAccountSettings() {
    setDropOpen(false);
    setMenuOpen(false);
    setAccountSettingsOpen(true);
    logActivity('opened_account_settings');
  }

  function openSwitchAccount() {
    setDropOpen(false);
    setMenuOpen(false);
    setSwitchConfirmOpen(true);
  }

  function confirmSwitchAccount() {
    setSwitchConfirmOpen(false);
    setSwitchAccountOpen(true);
  }

  async function handleExportPDF() {
    if (isExporting) return;
    logActivity('exported_pdf');
    if (!dashState.rawData) {
      showExportError('No dashboard data loaded yet. Please wait for data to load first.');
      return;
    }
    setIsExporting(true);
    try {
      // Small tick so the spinner renders before the heavy PDF work blocks the thread
      await new Promise((r) => setTimeout(r, 50));
      // Pass the logged-in user so the PDF can display the business name,
      // selected property name, and the property thumbnail image.
      await exportDashboardPDF(dashState, user);
    } catch (err) {
      console.error("PDF export failed:", err);
      // Show a mobile-friendly in-page error — alert() is unreliable on some
      // Android WebViews and gives no useful detail to the user.
      const msg = (err && err.message) ? err.message : 'Unknown error';
      showExportError('Export failed: ' + msg);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Mobile-friendly error display ─────────────────────────────────────────
  // Uses the same vanilla-JS modal pattern as _showPDFModal in pdfExportService
  // so error feedback works even when alert() is suppressed by the browser.
  function showExportError(message) {
    const existing = document.getElementById('__hostops_export_err');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = '__hostops_export_err';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(12,28,20,0.72);' +
      'backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;' +
      'width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.22)">' +
        '<div style="width:48px;height:48px;background:#fdecea;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c13515" ' +
          'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' +
            '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
          '</svg>' +
        '</div>' +
        '<p style="font-weight:700;font-size:16px;color:#0c1c14;margin:0 0 8px">Export failed</p>' +
        '<p style="font-size:13px;color:#6a8b7c;margin:0 0 20px;line-height:1.5;word-break:break-word">' +
          message.replace(/</g, '&lt;') +
        '</p>' +
        '<button id="__hostops_export_err_close" ' +
        'style="background:#26a676;color:#fff;border:none;border-radius:10px;' +
        'padding:13px 32px;font-weight:600;font-size:14px;cursor:pointer">OK</button>' +
      '</div>';
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const btn = document.getElementById('__hostops_export_err_close');
    if (btn) btn.addEventListener('click', close);
  }

  // ── External links: open hostops domains in a new tab ─────────────────────
  // Any <a href> pointing to go.hostops.online or hostops.online should open
  // in a new tab with noopener/noreferrer for security.
  useEffect(() => {
    const HOSTOPS_ORIGINS = ['https://go.hostops.online', 'https://hostops.online'];
    function handleAnchorClick(e) {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const isExternal = HOSTOPS_ORIGINS.some(
        (origin) => href.startsWith(origin) || href.startsWith(origin + '/')
      );
      if (isExternal && anchor.target !== '_blank') {
        e.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  // ── Logout confirmation modal ──────────────────────────────────────────────
  // ── Shared confirm-modal keyframes (injected once) ────────────────────────
  const ConfirmModalStyles = (
    <style>{`
      @keyframes hp-overlay-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes hp-card-in {
        from { opacity: 0; transform: translateY(24px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }
      @keyframes hp-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  );

  const LogoutModal = logoutModalOpen ? (
    <>
      {ConfirmModalStyles}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(12,28,20,0.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'hp-overlay-in 0.22s ease forwards',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) cancelLogout(); }}
      >
        <div style={{
          background: dark ? '#1a2e20' : '#fff',
          border: `1px solid ${dark ? '#1e3a2a' : '#e3ede8'}`,
          borderRadius: '20px',
          padding: '32px 28px 28px',
          maxWidth: '340px',
          width: '100%',
          boxShadow: '0 32px 80px rgba(12,28,20,0.28)',
          textAlign: 'center',
          animation: 'hp-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          {/* Icon circle */}
          <div style={{
            width: '56px', height: '56px',
            borderRadius: '50%',
            background: dark ? '#2a1515' : '#fff0ee',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            border: `1.5px solid ${dark ? '#4a2020' : '#ffd5ce'}`,
          }}>
            {isLoggingOut ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#c13515" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: 'hp-spin 0.7s linear infinite' }}>
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <i className="ti ti-logout" style={{ fontSize: '22px', color: '#c13515' }} />
            )}
          </div>

          <p style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '16px',
            color: dark ? '#eaf5f0' : '#0c1c14', margin: '0 0 8px' }}>
            {isLoggingOut ? 'Signing out…' : 'Sign out?'}
          </p>
          <p style={{ fontSize: '13px', color: dark ? '#9ab8a9' : '#6a8b7c',
            lineHeight: 1.6, margin: '0 0 24px' }}>
            {isLoggingOut
              ? 'Please wait while we securely sign you out.'
              : "You'll be signed out of your HostOps account."}
          </p>

          {!isLoggingOut && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={cancelLogout} style={{
                flex: 1, padding: '11px 0', borderRadius: '10px',
                border: `1px solid ${dark ? '#1e3a2a' : '#d4e8dd'}`,
                background: dark ? '#132a1e' : '#f3f9f5',
                color: dark ? '#9ab8a9' : '#4a7a62',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={confirmLogout} style={{
                flex: 1, padding: '11px 0', borderRadius: '10px',
                border: 'none', background: '#c13515', color: '#fff',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <i className="ti ti-logout" style={{ fontSize: '14px' }} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  const SwitchConfirmModal = switchConfirmOpen ? (
    <>
      {ConfirmModalStyles}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(12,28,20,0.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'hp-overlay-in 0.22s ease forwards',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setSwitchConfirmOpen(false); }}
      >
        <div style={{
          background: dark ? '#1a2e20' : '#fff',
          border: `1px solid ${dark ? '#1e3a2a' : '#e3ede8'}`,
          borderRadius: '20px',
          padding: '32px 28px 28px',
          maxWidth: '340px',
          width: '100%',
          boxShadow: '0 32px 80px rgba(12,28,20,0.28)',
          textAlign: 'center',
          animation: 'hp-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          {/* Icon circle */}
          <div style={{
            width: '56px', height: '56px',
            borderRadius: '50%',
            background: dark ? '#132a1e' : '#eaf8f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            border: `1.5px solid ${dark ? '#1e3a2a' : '#b7e4cf'}`,
          }}>
            <i className="ti ti-arrows-exchange" style={{ fontSize: '22px', color: '#1e8760' }} />
          </div>

          <p style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '16px',
            color: dark ? '#eaf5f0' : '#0c1c14', margin: '0 0 8px' }}>
            Switch account?
          </p>
          <p style={{ fontSize: '13px', color: dark ? '#9ab8a9' : '#6a8b7c',
            lineHeight: 1.6, margin: '0 0 24px' }}>
            You'll be switching to a different HostOps account. Your current session stays active.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setSwitchConfirmOpen(false)} style={{
              flex: 1, padding: '11px 0', borderRadius: '10px',
              border: `1px solid ${dark ? '#1e3a2a' : '#d4e8dd'}`,
              background: dark ? '#132a1e' : '#f3f9f5',
              color: dark ? '#9ab8a9' : '#4a7a62',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={confirmSwitchAccount} style={{
              flex: 1, padding: '11px 0', borderRadius: '10px',
              border: 'none', background: '#1e8760', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <i className="ti ti-arrows-exchange" style={{ fontSize: '14px' }} />
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  ) : null;

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
                    position: 'fixed', top: '60px', left: 8, right: 8,
                    width: 'auto',
                    background: dark ? '#1a2e20' : '#fff',
                    border: `1px solid ${dark ? '#1e3a2a' : '#d4eddf'}`,
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    zIndex: 9999, overflow: 'hidden',
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

              <Link to="/inbox" style={{ ...t.iconBtn, textDecoration: 'none' }} aria-label="Inbox">
                <i className="ti ti-inbox" style={t.iconBtnIcon} aria-hidden="true" />
              </Link>

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
                  {avatarInitial || "U"}
                </div>
                <div style={t.dropdown}>
                  <div style={t.dropHeader}>
                    <p style={t.dropName}>
                      {displayName}
                    </p>
                    <p style={t.dropEmail}>{user?.email || ""}</p>
                  </div>
                  <div style={t.dropBody}>
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
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                      onClick={openSwitchAccount}
                    >
                      <i
                        className="ti ti-arrows-exchange"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Switch account
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
        <SwitchAccountModal
          isOpen={switchAccountOpen}
          onClose={() => setSwitchAccountOpen(false)}
          onSwitch={({ id, name, fromPropertyId, fromPropertyName }) => {
            // fromPropertyId/fromPropertyName are captured by SwitchAccountModal
            // BEFORE it overwrites safeStorage — so these are always the correct
            // "from" values even if the user switches to a same-named property.
            logActivity('switched_property', {
              fromPropertyId,
              fromPropertyName,
              toPropertyId:   id,
              toPropertyName: name,
            });
            selectProperty(id, name);
            setSwitchAccountOpen(false);
          }}
        />
        {LogoutModal}
        {SwitchConfirmModal}
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
                  width: 'clamp(280px, 90vw, 340px)',
                  background: dark ? '#1a2e20' : '#fff',
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
                  {avatarInitial || "U"}
                </div>
                <span style={t.userName}>{displayName}</span>
                <i
                  className="ti ti-chevron-down"
                  style={t.chevron}
                  aria-hidden="true"
                />
              </div>

              <div style={t.dropdown}>
                <div style={t.dropHeader}>
                  <p style={t.dropName}>
                    {displayName}
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
                    style={{ ...t.dropBtn, color: dark ? "#eaf5f0" : "#0c1c14" }}
                    onClick={openSwitchAccount}
                  >
                    <i
                      className="ti ti-arrows-exchange"
                      style={{ fontSize: "15px", color: "#1e8760" }}
                      aria-hidden="true"
                    />
                    Switch account
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
      <SwitchAccountModal
        isOpen={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        onSwitch={({ id, name, fromPropertyId, fromPropertyName }) => {
            // fromPropertyId/fromPropertyName are captured by SwitchAccountModal
            // BEFORE it overwrites safeStorage — so these are always the correct
            // "from" values even if the user switches to a same-named property.
            logActivity('switched_property', {
              fromPropertyId,
              fromPropertyName,
              toPropertyId:   id,
              toPropertyName: name,
            });
            selectProperty(id, name);
            setSwitchAccountOpen(false);
          }}
      />
      {LogoutModal}
      {SwitchConfirmModal}
    </>
  );
}