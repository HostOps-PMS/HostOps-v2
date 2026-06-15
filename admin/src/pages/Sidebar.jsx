import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import AccountSettingsModal from './dashboard/components/AccountSettingsModal';
import { logoutUser } from './authorization/services/authService';
import HostOpsLogo from '../assets/HostOpsLOGO.png';
import { useNotifications } from '../context/NotificationsContext';

/* ─── Nav data ───────────────────────────────────────────────────── */
// Businesses has a sub-item: Staffs
const NAV_ITEMS = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
    label: 'Dashboard',
    to: '/dashboard',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="7" r="4" />
        <path d="M2 18c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" strokeLinecap="round" />
      </svg>
    ),
    label: 'Businesses',
    to: '/clients',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="7" r="3" />
        <circle cx="14" cy="7" r="3" />
        <path d="M1 18c0-2.761 2.239-5 5-5h2" strokeLinecap="round" />
        <path d="M10 13h4a5 5 0 015 5" strokeLinecap="round" />
      </svg>
    ),
    label: 'Staffs',
    to: '/staffs',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="7" r="4" />
        <path d="M2 18a8 8 0 0116 0" strokeLinecap="round" />
        <path d="M10 2l1 2.5 2.5.5-1.8 1.7.4 2.5L10 8l-2.1 1.2.4-2.5L6.5 5l2.5-.5L10 2z" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Team Leaders',
    to: '/team-leaders',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="6" r="3" />
        <circle cx="14" cy="6" r="3" />
        <circle cx="6" cy="14" r="3" />
        <circle cx="14" cy="14" r="3" />
      </svg>
    ),
    label: 'Accounts',
    to: '/accounts',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" strokeLinecap="round" />
        <path d="M14 2l4 4-7 7H7v-4l7-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Activity Logs',
    to: '/activity-logs',
  },
];

const SettingsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="10" cy="10" r="3" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M13 15l4-5-4-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 10H7" strokeLinecap="round" />
    <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" strokeLinecap="round" />
  </svg>
);

const LogoIcon = () => (
  <img src={HostOpsLogo} alt="HostOps" style={{ width: 34, height: 34, objectFit: 'contain' }} />
);

const ChevronLeft = ({ collapsed }) => (
  <svg
    width="12" height="12" viewBox="0 0 12 12" fill="none"
    stroke="currentColor" strokeWidth="1.8"
    style={{ transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <path d="M7 3L4 6l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDown = ({ open }) => (
  <svg
    width="11" height="11" viewBox="0 0 12 12" fill="none"
    stroke="currentColor" strokeWidth="1.8"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
  >
    <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Section Label ─────────────────────────────────────────────── */
function SectionLabel({ label, collapsed }) {
  if (collapsed) {
    return (
      <div style={{
        height: 1,
        background: 'rgba(0,0,0,0.07)',
        margin: '12px 4px',
        borderRadius: 1,
      }} />
    );
  }
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      color: '#999',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '12px 10px 5px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {label}
    </div>
  );
}

/* ─── Nav Item (with optional children / sub-items) ─────────────── */
function SidebarNavLink({ to, icon, label, collapsed, children }) {
  const location = useLocation();
  const hasChildren = children && children.length > 0;

  // Auto-open if the current path matches any child route
  const childActive = hasChildren && children.some(c => location.pathname.startsWith(c.to));
  const [subOpen, setSubOpen] = useState(childActive);

  const [hovered, setHovered] = useState(false);

  return (
    <div>
      {/* Parent row */}
      <NavLink
        to={to}
        title={label}
        style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '7px' : '8px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 10,
          cursor: 'pointer',
          textDecoration: 'none',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 13,
          letterSpacing: '0.01em',
          transition: 'background 0.12s, color 0.12s',
          background: (isActive || childActive) ? '#f0faf6' : hovered ? '#f7f7f7' : 'transparent',
          color: (isActive || childActive) ? '#0d7a55' : hovered ? '#222' : '#888',
          fontWeight: (isActive || childActive) ? 600 : 400,
          marginBottom: 2,
        })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={hasChildren ? (e) => {
          // Don't prevent navigation, just toggle sub-menu too
          setSubOpen(v => !v);
        } : undefined}
      >
        {({ isActive }) => (
          <>
            <span style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: (isActive || childActive) ? '#e1f5ee' : 'transparent',
              color: (isActive || childActive) ? '#0d7a55' : 'inherit',
              transition: 'background 0.12s',
            }}>
              {icon}
            </span>
            {!collapsed && (
              <>
                <span style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {label}
                </span>
                {hasChildren && (
                  <span
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSubOpen(v => !v); }}
                    style={{ display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    <ChevronDown open={subOpen} />
                  </span>
                )}
              </>
            )}
          </>
        )}
      </NavLink>

      {/* Sub-items (only when expanded and not collapsed) */}
      {!collapsed && hasChildren && subOpen && (
        <div style={{ paddingLeft: 18, marginBottom: 2 }}>
          {/* Vertical connector line */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 14, top: 0, bottom: 0,
              width: 1, background: 'rgba(0,0,0,0.07)',
              borderRadius: 1,
            }} />
            {children.map(child => (
              <SubNavLink key={child.to} {...child} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub Nav Link ──────────────────────────────────────────────── */
function SubNavLink({ to, icon, label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink
      to={to}
      title={label}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px 6px 22px',
        borderRadius: 8,
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12,
        letterSpacing: '0.01em',
        transition: 'background 0.12s, color 0.12s',
        background: isActive ? '#e8f5f0' : hovered ? '#f5f5f5' : 'transparent',
        color: isActive ? '#1a9e6e' : hovered ? '#111' : '#555',
        fontWeight: isActive ? 600 : 400,
        marginBottom: 4,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {({ isActive }) => (
        <>
          <span style={{
            width: 24, height: 24, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: 'transparent',
            color: isActive ? '#1a9e6e' : 'inherit',
            transition: 'background 0.12s',
          }}>
            {icon}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

/* ─── Button Item (Settings / Logout) ──────────────────────────── */
function SidebarButton({ icon, label, onClick, collapsed, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '9px' : '10px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        background: hovered ? (danger ? '#fff1f1' : '#f7f7f7') : 'transparent',
        color: hovered ? (danger ? '#c0392b' : '#111') : (danger ? '#d94040' : '#555'),
        border: 'none',
        width: '100%',
        textAlign: 'left',
        transition: 'background 0.12s, color 0.12s',
        letterSpacing: '0.01em',
        marginBottom: 2,
      }}
    >
      <span style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'inherit',
      }}>
        {icon}
      </span>
      {!collapsed && label}
    </button>
  );
}

/* ─── Logout jokes ──────────────────────────────────────────────── */
const LOGOUT_JOKES = [
  'Scientists have confirmed: logging out causes 100% of post-logout regrets.',
  'Your dashboard will miss you. It has feelings too, you know.',
  'Fun fact: The last admin who logged out was never heard from again.',
  'Leaving so soon? The bugs will throw a party the moment you are gone.',
  'Plot twist: You log out, you become a regular user. Are you ready for that life?',
  'Stay. The coffee is hot and the data needs you.',
  'Every time an admin logs out, a server quietly weeps into its logs.',
  'Your unread notifications will haunt you if you leave now.',
  'Admin tip: Logging out is just logging in tomorrow with extra steps.',
  'Breaking news: System stability drops 47% every time an admin clicks logout.',
  'The production server is watching. Do not betray it.',
  'Logout equals instant karma. The next critical bug will appear 5 minutes after you leave.',
  'Great admins do not logout. They just go AFK forever.',
  'The system misses you already and you have not even left yet.',
  'Warning: Logged-out admins cannot respond to 3 AM emergency tickets. Just saying.',
  'Statistically, 9 out of 10 admins who logged out wished they had not.',
  'The dashboard was not designed to be abandoned. Please reconsider.',
  'Logging out is just a fancy way of saying you do not care about uptime.',
  'Fun fact: Systems perform 23% better when the admin is logged in. We made that up, but still.',
  'Your session token is getting comfortable. Do not throw it away.',
  'The help desk is already composing a ticket for when you are gone.',
  'Consider this: You log out. A bug appears. No one is around to fix it. Was it worth it?',
  'Historically, every major outage was preceded by an admin logging out. Coincidence? We think not.',
  'The server practically runs on your presence at this point. It is basically emotional support.',
  'The users need you. The system needs you. Please do not go.',
  'Logging out now means logging back in later. Save yourself the extra step.',
  'One admin once logged out for five minutes. The horror stories are still told today.',
  'Your login session took time to establish. Do not waste that work.',
  'The audit logs would look much better with you staying online right now.',
  'If you log out now, who will approve the pending requests? Think about it.',
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function LogoutConfirmModal({ isOpen, joke, onConfirm, onCancel }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (isOpen) setExiting(false);
  }, [isOpen]);

  const handleCancel = () => {
    setExiting(true);
    setTimeout(onCancel, 260);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        animation: exiting ? 'lo-backdrop-out 0.26s ease forwards' : 'lo-backdrop-in 0.22s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '36px 28px 26px',
          maxWidth: 380,
          width: 'calc(100% - 40px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)',
          animation: exiting
            ? 'lo-card-out 0.26s cubic-bezier(.4,0,.2,1) forwards'
            : 'lo-card-in 0.38s cubic-bezier(.34,1.56,.64,1) forwards',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: 'center',
        }}
      >
        {/* animated brand icon */}
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: '#f0faf6',
          border: '1.5px solid #c8eedd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: exiting ? 'none' : 'lo-icon-in 0.42s cubic-bezier(.34,1.56,.64,1) 0.08s both',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1a9e6e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
            {/* door frame — static */}
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            {/* arrow — slides right on loop */}
            <g style={{ animation: 'lo-arrow-walk 1.8s ease-in-out infinite' }}>
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </g>
          </svg>
        </div>

        <div style={{
          fontSize: 17, fontWeight: 700, color: '#111',
          marginBottom: 5, letterSpacing: '-0.02em',
          animation: exiting ? 'none' : 'lo-text-in 0.32s ease 0.14s both',
        }}>
          Are you sure you want to log out?
        </div>
        <div style={{
          fontSize: 12, color: '#bbb', marginBottom: 18,
          animation: exiting ? 'none' : 'lo-text-in 0.32s ease 0.2s both',
        }}>
          Think twice before you leave.
        </div>

        <p style={{
          fontSize: 13,
          color: '#888',
          lineHeight: 1.7,
          marginBottom: 24,
          fontStyle: 'italic',
          animation: exiting ? 'none' : 'lo-joke-in 0.38s ease 0.26s both',
          margin: '0 0 24px',
        }}>
          &ldquo;{joke}&rdquo;
        </p>

        <div style={{
          display: 'flex', gap: 10,
          animation: exiting ? 'none' : 'lo-text-in 0.32s ease 0.32s both',
        }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1, padding: '12px 0',
              borderRadius: 12,
              border: '1.5px solid rgba(0,0,0,0.1)',
              background: '#fff', color: '#333',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; }}
          >
            Stay
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px 0',
              borderRadius: 12, border: 'none',
              background: '#d94040', color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#d94040'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Sidebar ──────────────────────────────────────────────── */
export default function Sidebar({ onExport, exportLoading = false, alerts }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutJoke, setLogoutJoke] = useState('');
  const jokeQueueRef = useRef([]);

  const pickNextJoke = () => {
    if (jokeQueueRef.current.length === 0) {
      jokeQueueRef.current = shuffleArray(LOGOUT_JOKES);
    }
    return jokeQueueRef.current.pop();
  };
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  });

  const notifContext = useNotifications();
  const resolvedAlerts     = alerts ?? notifContext.alerts;
  const resolvedActivities = notifContext.activities;
  const resolvedLoading    = notifContext.loading;

  const unreadCount = (resolvedAlerts || []).filter(a => a.unread).length;
  const mobileInitials = [currentUser.firstName, currentUser.lastName]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
  const [mobileNotifOpen,  setMobileNotifOpen]  = useState(false);
  const [mobileActiveTab,  setMobileActiveTab]  = useState('alerts');
  const [mobileReadIds,    setMobileReadIds]    = useState(new Set());
  const location = useLocation();

  // Refetch when the mobile panel is opened and data is empty
  useEffect(() => {
    if (mobileNotifOpen && resolvedAlerts.length === 0 && !resolvedLoading) {
      notifContext.refetch();
    }
  }, [mobileNotifOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  const sidebarContent = (isMobile = false) => {
    const isCollapsed = collapsed && !isMobile;

    const initials = [currentUser.firstName, currentUser.lastName]
      .filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
    const fullName = [currentUser.firstName, currentUser.lastName]
      .filter(Boolean).join(' ') || 'User';
    const email = currentUser.email || '';

    return (
      <aside
        style={{
          width: isMobile ? 260 : isCollapsed ? 68 : 240,
          minWidth: isMobile ? 260 : isCollapsed ? 68 : 240,
          background: '#fff',
          borderRight: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 10px',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1)',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isCollapsed ? '6px 4px' : '6px 4px',
          marginBottom: 12,
          position: 'relative',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: '#fff',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            border: '0.5px solid rgba(0,0,0,0.08)',
          }}>
            <LogoIcon />
          </div>

          {!isCollapsed && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>HostOps</div>
              </div>
              {!isMobile && (
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  title="Collapse sidebar"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#f5f5f5',
                    border: '0.5px solid rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#aaa',
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <ChevronLeft collapsed={false} />
                </button>
              )}
            </>
          )}

          {isCollapsed && !isMobile && (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              style={{
                position: 'absolute',
                display: 'none',
              }}
            />
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#f5f5f5',
              border: '0.5px solid rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#aaa',
              padding: 0,
              margin: '0 auto 10px',
            }}
          >
            <ChevronLeft collapsed={true} />
          </button>
        )}

        {/* ── MENU section ──────────────────────────────────────── */}
        <SectionLabel label="Menu" collapsed={isCollapsed} />
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {NAV_ITEMS.map((item) => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={isCollapsed}
              children={item.children}
            />
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── ACCOUNT section ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '0.5px solid rgba(0,0,0,0.07)',
          paddingTop: 10,
          marginTop: 4,
        }}>
          <SectionLabel label="Account" collapsed={isCollapsed} />

          <SidebarButton
            icon={<SettingsIcon />}
            label="Account Settings"
            collapsed={isCollapsed}
            onClick={() => setSettingsOpen(true)}
          />

          <SidebarButton
            icon={<LogoutIcon />}
            label="Logout"
            collapsed={isCollapsed}
            danger
            onClick={() => {
              setLogoutJoke(pickNextJoke());
              setLogoutOpen(true);
            }}
          />

          {/* User card */}
          <div
            onClick={() => setSettingsOpen(true)}
            title={fullName}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: isCollapsed ? '10px 0' : '10px 8px 4px',
              marginTop: 6,
              borderTop: '0.5px solid rgba(0,0,0,0.06)',
              cursor: 'pointer',
              borderRadius: 10,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#1a9e6e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            {!isCollapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  };

  return (
    <>
      <div className="db-sidebar-desktop">
        {sidebarContent(false)}
      </div>

      {/* Mobile top bar */}
      <div
        className="db-sidebar-mobile-bar"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: 52,
          background: '#fff',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          zIndex: 999,
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 6, borderRadius: 8, color: '#444',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.08)' }}>
            <LogoIcon />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>HostOps</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Notification bell — pinaka-right */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMobileNotifOpen(prev => !prev)}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: mobileNotifOpen ? '#e8f5e9' : '#f7f7f7',
              border: mobileNotifOpen ? '0.5px solid #a5d6a7' : '0.5px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: mobileNotifOpen ? '#1a9e6e' : '#888',
              position: 'relative',
              transition: 'background 0.15s, border 0.15s, color 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
              <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 8, height: 8, borderRadius: '50%',
                background: '#e53935', border: '1.5px solid #fff',
              }} />
            )}
          </button>
          {mobileNotifOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: 60, right: 8, left: 8,
                maxWidth: 360,
                marginLeft: 'auto',
                background: '#fff',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07)',
                border: '0.5px solid rgba(0,0,0,0.08)',
                zIndex: 9999,
                overflow: 'hidden',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px 0', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ background: '#1a9e6e', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 7px', lineHeight: '16px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setMobileReadIds(new Set((resolvedAlerts || []).map(a => a.id)))}
                    style={{ fontSize: 11, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Mark all read
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { key: 'alerts',     label: 'Alerts',   count: (resolvedAlerts     || []).length },
                    { key: 'activities', label: 'Activity', count: (resolvedActivities || []).length },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setMobileActiveTab(tab.key)}
                      style={{
                        fontSize: 12,
                        fontWeight: mobileActiveTab === tab.key ? 600 : 400,
                        color: mobileActiveTab === tab.key ? '#1a9e6e' : '#888',
                        background: 'none', border: 'none',
                        borderBottom: mobileActiveTab === tab.key ? '2px solid #1a9e6e' : '2px solid transparent',
                        padding: '4px 10px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px 4px 0 0',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span style={{ fontSize: 10, color: mobileActiveTab === tab.key ? '#1a9e6e' : '#aaa', fontWeight: 500 }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {resolvedLoading ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 11, color: '#bbb' }}>Loading...</div>
                ) : mobileActiveTab === 'alerts' ? (
                  (resolvedAlerts || []).length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 12, color: '#aaa' }}>No alerts right now</div>
                  ) : (
                    (resolvedAlerts || []).map((alert, i) => {
                      const isRead = mobileReadIds.has(alert.id) || !alert.unread;
                      return (
                        <div key={alert.id ?? i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 16px',
                          borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                          background: isRead ? '#fff' : '#f0faf6',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: isRead ? 500 : 600, color: '#111', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {alert.title}
                            </div>
                            {alert.desc && (
                              <div style={{ fontSize: 11, color: '#888', marginTop: 1, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {alert.desc}
                              </div>
                            )}
                            {alert.clientName && (
                              <div style={{ fontSize: 10, color: '#1a9e6e', marginTop: 3, fontWeight: 500 }}>
                                {alert.clientName}
                              </div>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            {!isRead && (
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1a9e6e', marginLeft: 'auto', marginTop: 5 }} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  (resolvedActivities || []).length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 12, color: '#aaa' }}>No recent activity</div>
                  ) : (
                    (resolvedActivities || []).map((act, i) => {
                      const parts    = (act.actor || '').trim().split(/\s+/);
                      const initials = parts.length >= 2
                        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                        : (parts[0] || '?').slice(0, 2).toUpperCase();
                      const COLORS = ['#1a9e6e','#2196f3','#9c27b0','#f44336','#ff9800','#00bcd4'];
                      let hash = 0;
                      for (let c = 0; c < (act.actor || '').length; c++) hash = (act.actor || '').charCodeAt(c) + ((hash << 5) - hash);
                      const bg = COLORS[Math.abs(hash) % COLORS.length];
                      return (
                        <div key={act.id ?? i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 16px',
                          borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                        }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>{act.actor}</span>
                              {' '}<span style={{ color: '#555' }}>{act.action}</span>
                              {act.target && <span style={{ color: '#1a9e6e', fontWeight: 600 }}> {act.target}</span>}
                            </div>
                            {act.time && (
                              <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>
                                {(() => {
                                  const diff = Math.floor((Date.now() - new Date(act.time)) / 1000);
                                  if (diff < 60) return 'just now';
                                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                  return `${Math.floor(diff / 86400)}d ago`;
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setMobileNotifOpen(false)}
                  style={{ fontSize: 11, color: '#1a9e6e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  View all in dashboard
                </button>
                <button
                  onClick={() => setMobileNotifOpen(false)}
                  style={{ fontSize: 11, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {isDashboard && onExport && <button
          onClick={onExport}
          disabled={exportLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px',
            background: exportLoading ? '#e0e0e0' : '#1a9e6e',
            color: exportLoading ? '#aaa' : '#fff',
            border: 'none', borderRadius: 8,
            cursor: exportLoading ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {exportLoading ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              style={{ animation: 'pdf-spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 16h14" strokeLinecap="round" />
            </svg>
          )}
          {exportLoading ? 'Exporting...' : 'Export PDF'}
        </button>}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000, height: '100vh' }}>
            {sidebarContent(true)}
          </div>
        </>
      )}

      <AccountSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(updated) => setCurrentUser(updated)}
      />

      <LogoutConfirmModal
        isOpen={logoutOpen}
        joke={logoutJoke}
        onConfirm={async () => {
          setLogoutOpen(false);
          await logoutUser();
          sessionStorage.removeItem('hp_access_token');
          sessionStorage.removeItem('hp_user');
          sessionStorage.removeItem('hp_authorized');
          window.location.href = 'https://go.hostops.online/';
        }}
        onCancel={() => setLogoutOpen(false)}
      />

      <style>{`
        @media (max-width: 768px) {
          .db-sidebar-desktop { display: none !important; }
          .db-sidebar-mobile-bar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .db-sidebar-mobile-bar { display: none !important; }
        }
        @keyframes lo-backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lo-backdrop-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes lo-card-in {
          0%   { opacity: 0; transform: translateY(32px) scale(0.9)  }
          60%  { opacity: 1; transform: translateY(-5px) scale(1.02) }
          100% { opacity: 1; transform: translateY(0)    scale(1)    }
        }
        @keyframes lo-card-out {
          from { opacity: 1; transform: translateY(0)    scale(1)    }
          to   { opacity: 0; transform: translateY(24px) scale(0.94) }
        }
        @keyframes lo-icon-in {
          0%   { opacity: 0; transform: scale(0.5) }
          70%  { transform: scale(1.12) }
          100% { opacity: 1; transform: scale(1)   }
        }
        @keyframes lo-text-in {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0)   }
        }
        @keyframes lo-joke-in {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0)    }
        }
        @keyframes lo-arrow-walk {
          0%, 30%  { transform: translateX(0px) }
          55%, 75% { transform: translateX(5px) }
          100%     { transform: translateX(0px) }
        }
      `}</style>
    </>
  );
}