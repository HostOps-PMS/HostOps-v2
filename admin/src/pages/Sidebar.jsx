import { NavLink, useLocation } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import AccountSettingsModal from './dashboard/components/AccountSettingsModal';
import { logoutUser } from './authorization/services/authService';
import HostOpsLogo from '../assets/HostOpsLOGO.png';
import { useNotifications } from '../context/NotificationsContext';
import { useTheme } from '../context/ThemeContext';
import { FaUsers, FaChartLine, FaChevronDown, FaBug, FaTractor, FaBoxOpen, FaShieldAlt } from 'react-icons/fa';
import { getSecureUser, removeSecureUser } from '../lib/secureUserStorage';
import { fetchWithAuth } from '../lib/authUtils';

/* ─── Nav data ───────────────────────────────────────────────────── */

// PINNED
const PINNED_ITEMS = [
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>,
    label: 'Dashboard',
    to: '/dashboard',
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="7" r="4"/><path d="M2 18c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" strokeLinecap="round"/></svg>,
    label: 'Businesses',
    to: '/clients',
  },
];

// MANAGE
const MANAGE_ITEMS = [
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="7" r="3"/><circle cx="14" cy="7" r="3"/><path d="M1 18c0-2.761 2.239-5 5-5h2" strokeLinecap="round"/><path d="M10 13h4a5 5 0 015 5" strokeLinecap="round"/></svg>,
    label: 'Team',
    to: '/staffs',
    children: [
      { label: 'Staffs', to: '/staffs' },
      { label: 'Team Leaders', to: '/team-leaders' },
    ],
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="3"/><circle cx="14" cy="6" r="3"/><circle cx="6" cy="14" r="3"/><circle cx="14" cy="14" r="3"/></svg>,
    label: 'Accounts',
    to: '/accounts',
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 5h14M3 5v12a1 1 0 001 1h12a1 1 0 001-1V5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 2h4a1 1 0 011 1v2H7V3a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10h6M7 13h4" strokeLinecap="round"/></svg>,
    label: 'Announcements',
    to: '/announcements',
  },
];

// MONITORING
const MONITORING_ITEMS = [
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2a6 6 0 00-6 6c0 3-1.5 4.5-2 5h16c-.5-.5-2-2-2-5a6 6 0 00-6-6z" strokeLinejoin="round"/><path d="M8.5 17.5a1.5 1.5 0 003 0" strokeLinecap="round"/></svg>,
    label: 'Alerts Center',
    to: '/alerts',
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    label: 'Recent Activities',
    to: '/recent-activities',
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" strokeLinecap="round"/><path d="M14 2l4 4-7 7H7v-4l7-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    label: 'Activity Logs',
    to: '/activity-logs',
  },
];

// SECURITY & REPORTS
const SECURITY_ITEMS = [
  {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    label: 'Honeypot Security',
    to: '/honeypot',
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="8"/><path d="M10 6v5" strokeLinecap="round"/><circle cx="10" cy="14" r="0.5" fill="currentColor"/></svg>,
    label: 'Bug Reports',
    to: '/bug-reports',
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

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M17 12A7 7 0 119 4a5 5 0 008 8z" strokeLinejoin="round" />
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="10" cy="10" r="4" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round" />
  </svg>
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
  const { dark } = useTheme();
  if (collapsed) {
    return (
      <div style={{
        height: 1,
        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
        margin: '10px 4px',
        borderRadius: 1,
      }} />
    );
  }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 10px 4px',
    }}>
      <span style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: dark ? '#4d8a6a' : '#aaa',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 1,
        background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
        borderRadius: 1,
      }} />
    </div>
  );
}

/* ─── Nav Item (with optional children / sub-items) ─────────────── */
function SidebarNavLink({ to, icon, label, collapsed, children }) {
  const { dark } = useTheme();
  const location = useLocation();
  const hasChildren = children && children.length > 0;

  const childActive = hasChildren && children.some(c => location.pathname.startsWith(c.to));
  const [subOpen, setSubOpen] = useState(childActive);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <NavLink
        to={to}
        title={label}
        style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '7px' : '7px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 10,
          cursor: 'pointer',
          textDecoration: 'none',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 13,
          letterSpacing: '0.01em',
          transition: 'background 0.12s, color 0.12s',
          background: (isActive || childActive)
            ? (dark ? '#0d2619' : '#eef9f4')
            : hovered
              ? (dark ? '#0f2416' : '#f5f5f5')
              : 'transparent',
          color: (isActive || childActive)
            ? (dark ? '#26c47a' : '#0a6644')
            : hovered
              ? (dark ? '#eaf5f0' : '#222')
              : (dark ? '#7ab89a' : '#6b7280'),
          fontWeight: (isActive || childActive) ? 600 : 400,
          marginBottom: 1,
        })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={hasChildren ? () => { setSubOpen(v => !v); } : undefined}
      >
        {({ isActive }) => (
          <>
            {/* Left accent bar */}
            {(isActive || childActive) && !collapsed && (
              <span style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 18,
                borderRadius: 2,
                background: dark ? '#26c47a' : '#0a6644',
              }} />
            )}
            <span style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: (isActive || childActive)
                ? (dark ? '#1a3d28' : '#d6f0e4')
                : hovered
                  ? (dark ? '#132a1e' : '#ebebeb')
                  : 'transparent',
              color: (isActive || childActive)
                ? (dark ? '#26c47a' : '#0a6644')
                : 'inherit',
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

      {!collapsed && hasChildren && subOpen && (
        <div style={{ paddingLeft: 18, marginBottom: 2 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 14, top: 0, bottom: 0,
              width: 1,
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
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
  const { dark } = useTheme();
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
        background: isActive
          ? (dark ? '#0d2619' : '#e8f5f0')
          : hovered
            ? (dark ? '#0f2416' : '#f5f5f5')
            : 'transparent',
        color: isActive
          ? (dark ? '#26c47a' : '#1a9e6e')
          : hovered
            ? (dark ? '#eaf5f0' : '#111')
            : (dark ? '#7ab89a' : '#555'),
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
            color: isActive ? (dark ? '#26c47a' : '#1a9e6e') : 'inherit',
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
  const { dark } = useTheme();
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
        background: hovered
          ? (danger ? (dark ? '#2a0d0d' : '#fff1f1') : (dark ? '#0d2619' : '#f7f7f7'))
          : 'transparent',
        color: hovered
          ? (danger ? '#c0392b' : (dark ? '#eaf5f0' : '#111'))
          : (danger ? '#d94040' : (dark ? '#7ab89a' : '#555')),
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
        borderRadius: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: hovered
          ? (danger ? (dark ? '#3d1010' : '#ffe0e0') : (dark ? '#132a1e' : '#ebebeb'))
          : 'transparent',
        color: 'inherit',
        transition: 'background 0.12s',
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
  const { dark } = useTheme();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (isOpen) setExiting(false);
  }, [isOpen]);

  const handleCancel = () => {
    setExiting(true);
    setTimeout(onCancel, 260);
  };

  if (!isOpen) return null;

  const surface      = dark ? '#132a1e' : '#fff';
  const textMain     = dark ? '#eaf5f0' : '#111';
  const textDim      = dark ? '#4d8a6a' : '#bbb';
  const textJoke     = dark ? '#7ab89a' : '#888';
  const iconBg       = dark ? '#0d2619' : '#f0faf6';
  const iconBorder   = dark ? '1.5px solid #1e3a2a' : '1.5px solid #c8eedd';
  const stayBg       = dark ? '#0d2619' : '#fff';
  const stayHoverBg  = dark ? '#152e1f' : '#f5f5f5';
  const stayBorder   = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const stayHoverBorder = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  const stayColor    = dark ? '#eaf5f0' : '#333';

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        animation: exiting ? 'lo-backdrop-out 0.26s ease forwards' : 'lo-backdrop-in 0.22s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: surface,
          borderRadius: 20,
          padding: '36px 28px 26px',
          maxWidth: 380,
          width: 'calc(100% - 40px)',
          boxShadow: dark
            ? '0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)'
            : '0 24px 64px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)',
          animation: exiting
            ? 'lo-card-out 0.26s cubic-bezier(.4,0,.2,1) forwards'
            : 'lo-card-in 0.38s cubic-bezier(.34,1.56,.64,1) forwards',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: 'center',
          border: dark ? '0.5px solid #1e3a2a' : 'none',
        }}
      >
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: iconBg,
          border: iconBorder,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          animation: exiting ? 'none' : 'lo-icon-in 0.42s cubic-bezier(.34,1.56,.64,1) 0.08s both',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1a9e6e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <g style={{ animation: 'lo-arrow-walk 1.8s ease-in-out infinite' }}>
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </g>
          </svg>
        </div>

        <div style={{
          fontSize: 17, fontWeight: 700, color: textMain,
          marginBottom: 5, letterSpacing: '-0.02em',
          animation: exiting ? 'none' : 'lo-text-in 0.32s ease 0.14s both',
        }}>
          Are you sure you want to log out?
        </div>
        <div style={{
          fontSize: 12, color: textDim, marginBottom: 18,
          animation: exiting ? 'none' : 'lo-text-in 0.32s ease 0.2s both',
        }}>
          Think twice before you leave.
        </div>

        <p style={{
          fontSize: 13,
          color: textJoke,
          lineHeight: 1.7,
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
              border: `1.5px solid ${stayBorder}`,
              background: stayBg, color: stayColor,
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = stayHoverBg; e.currentTarget.style.borderColor = stayHoverBorder; }}
            onMouseLeave={e => { e.currentTarget.style.background = stayBg; e.currentTarget.style.borderColor = stayBorder; }}
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
  const { dark, toggleDark } = useTheme();
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
    try { return getSecureUser() || {}; } catch { return {}; }
  });

  useEffect(() => {
    function handleUserUpdated(e) {
      setCurrentUser(e.detail);
    }
    window.addEventListener('hostops:user-updated', handleUserUpdated);
    return () => window.removeEventListener('hostops:user-updated', handleUserUpdated);
  }, []);

  const notifContext = useNotifications();
  const resolvedAlerts     = alerts ?? notifContext.alerts;
  const resolvedActivities = notifContext.activities;
  const resolvedLoading    = notifContext.loading;

  const unreadCount = (resolvedAlerts || []).filter(a => a.unread).length;
  const [mobileNotifOpen,  setMobileNotifOpen]  = useState(false);
  const [mobileActiveTab,  setMobileActiveTab]  = useState('alerts');
  const [mobileReadIds,    setMobileReadIds]    = useState(new Set());
  const mobileBugReports = notifContext.bugReports || [];
  const location = useLocation();


  useEffect(() => {
    if (mobileNotifOpen && resolvedAlerts.length === 0 && !resolvedLoading) {
      notifContext.refetch();
    }
  }, [mobileNotifOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  // Theme tokens
  const sideBg       = dark ? '#132a1e' : '#fff';
  const sideBorder   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const logoBorder   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const titleColor   = dark ? '#eaf5f0' : '#111';
  const collBg       = dark ? '#0d2619' : '#f5f5f5';
  const collBorder   = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const collColor    = dark ? '#4d8a6a' : '#aaa';
  const userHoverBg  = dark ? '#0d2619' : '#f7f7f7';
  const userNameColor = dark ? '#eaf5f0' : '#222';
  const userEmailColor = dark ? '#4d8a6a' : '#aaa';
  const notifSurface = dark ? '#132a1e' : '#fff';
  const notifBorder  = dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)';
  const notifText    = dark ? '#eaf5f0' : '#111';
  const notifMuted   = dark ? '#7ab89a' : '#888';
  const notifDim     = dark ? '#4d8a6a' : '#bbb';
  const notifDiv     = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  const notifUnreadBg = dark ? '#0d2619' : '#f0faf6';
  const notifReadBg  = dark ? '#132a1e' : '#fff';
  const notifHover   = dark ? '#0d2619' : '#f8f9fa';

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
          background: sideBg,
          borderRight: `0.5px solid ${sideBorder}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 10px',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1), background 0.2s',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 4px 8px',
          marginBottom: 8,
          position: 'relative',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <div style={{
            width: 34,
            height: 34,
            background: dark ? '#0d2619' : '#f0faf6',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            border: `1px solid ${dark ? '#1e3a2a' : '#d6f0e4'}`,
          }}>
            <LogoIcon />
          </div>

          {!isCollapsed && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: titleColor, letterSpacing: '-0.03em' }}>HostOps</div>
                <div style={{ fontSize: 10, color: dark ? '#4d8a6a' : '#aaa', letterSpacing: '0.05em', marginTop: 1 }}>Admin Panel</div>
              </div>
              {!isMobile && (
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  title="Collapse sidebar"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: collBg,
                    border: `0.5px solid ${collBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: collColor,
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
              style={{ position: 'absolute', display: 'none' }}
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
              background: collBg,
              border: `0.5px solid ${collBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: collColor,
              padding: 0,
              margin: '0 auto 10px',
            }}
          >
            <ChevronLeft collapsed={true} />
          </button>
        )}

        {/* ── PINNED section ─────────────────────────────────── */}
        <SectionLabel label="Pinned" collapsed={isCollapsed} />
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {PINNED_ITEMS.map((item) => (
            <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={isCollapsed} />
          ))}

          {/* ── MANAGE section ──────────────────────────────── */}
          <SectionLabel label="Manage" collapsed={isCollapsed} />
          {MANAGE_ITEMS.map((item) => (
            <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={isCollapsed} children={item.children} />
          ))}

          {/* ── MONITORING section ──────────────────────────── */}
          <SectionLabel label="Monitoring" collapsed={isCollapsed} />
          {MONITORING_ITEMS.map((item) => (
            <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={isCollapsed} />
          ))}

          {/* ── SECURITY & REPORTS section ──────────────────── */}
          <SectionLabel label="Security & Reports" collapsed={isCollapsed} />
          {SECURITY_ITEMS.map((item) => (
            <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={isCollapsed} />
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── ACCOUNT section ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 4,
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
              borderTop: `0.5px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
              cursor: 'pointer',
              borderRadius: 10,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = userHoverBg}
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
                <div style={{ fontSize: 12, fontWeight: 600, color: userNameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: 11, color: userEmailColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          background: sideBg,
          borderBottom: `0.5px solid ${sideBorder}`,
          zIndex: 999,
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          transition: 'background 0.2s',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 6, borderRadius: 8, color: dark ? '#7ab89a' : '#444',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, background: sideBg, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', border: `0.5px solid ${logoBorder}`,
          }}>
            <LogoIcon />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: titleColor, letterSpacing: '-0.02em' }}>HostOps</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Dark mode toggle — mobile */}
        <button
          onClick={toggleDark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: dark ? '#0d2619' : '#f7f7f7',
            border: `0.5px solid ${dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: dark ? '#7ab89a' : '#888',
            flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Notification bell — mobile */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMobileNotifOpen(prev => !prev)}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: mobileNotifOpen ? (dark ? '#0d2619' : '#e8f5e9') : (dark ? '#0d2619' : '#f7f7f7'),
              border: mobileNotifOpen
                ? `0.5px solid ${dark ? '#1e3a2a' : '#a5d6a7'}`
                : `0.5px solid ${dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: mobileNotifOpen ? '#1a9e6e' : (dark ? '#7ab89a' : '#888'),
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
                background: '#e53935', border: `1.5px solid ${sideBg}`,
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
                background: notifSurface,
                borderRadius: 14,
                boxShadow: dark
                  ? '0 8px 32px rgba(0,0,0,0.5), 0 1.5px 6px rgba(0,0,0,0.3)'
                  : '0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07)',
                border: `0.5px solid ${notifBorder}`,
                zIndex: 9999,
                overflow: 'hidden',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              <style>{`.mob-notif-item:hover { background: ${notifHover} !important; }`}</style>

              {/* Header */}
              <div style={{ padding: '14px 16px 0', borderBottom: `0.5px solid ${notifBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: notifText }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ background: '#1a9e6e', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 7px', lineHeight: '16px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setMobileReadIds(new Set((resolvedAlerts || []).map(a => a.id)))}
                    style={{ fontSize: 11, color: notifDim, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Mark all read
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {[
                    { key: 'alerts',     label: 'Alerts',   count: (resolvedAlerts     || []).length },
                    { key: 'activities', label: 'Activity', count: (resolvedActivities || []).length },
                    { key: 'reports',    label: 'Reports',  count: mobileBugReports.length },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setMobileActiveTab(tab.key)}
                      style={{
                        fontSize: 12,
                        fontWeight: mobileActiveTab === tab.key ? 600 : 400,
                        color: mobileActiveTab === tab.key ? '#1a9e6e' : notifMuted,
                        background: 'none', border: 'none',
                        borderBottom: mobileActiveTab === tab.key ? '2px solid #1a9e6e' : '2px solid transparent',
                        padding: '4px 8px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px 4px 0 0',
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span style={{ fontSize: 10, color: mobileActiveTab === tab.key ? '#1a9e6e' : notifDim, fontWeight: 500 }}>
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
                  <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 11, color: notifDim }}>Loading...</div>
                ) : mobileActiveTab === 'alerts' ? (
                  (resolvedAlerts || []).length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 12, color: notifMuted }}>No alerts right now</div>
                  ) : (
                    (resolvedAlerts || []).map((alert, i) => {
                      const isRead = mobileReadIds.has(alert.id) || !alert.unread;
                      return (
                        <div key={alert.id ?? i} className="mob-notif-item" style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 16px',
                          borderBottom: `0.5px solid ${notifDiv}`,
                          background: isRead ? notifReadBg : notifUnreadBg,
                          transition: 'background 0.12s',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: isRead ? 500 : 600, color: notifText, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {alert.title}
                            </div>
                            {alert.desc && (
                              <div style={{ fontSize: 11, color: notifMuted, marginTop: 1, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                ) : mobileActiveTab === 'activities' ? (
                  (resolvedActivities || []).length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 12, color: notifMuted }}>No recent activity</div>
                  ) : (
                    (resolvedActivities || []).map((act, i) => {
                      const parts    = (act.actor || '').trim().split(/\s+/);
                      const actInit  = parts.length >= 2
                        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                        : (parts[0] || '?').slice(0, 2).toUpperCase();
                      const COLORS = ['#1a9e6e','#2196f3','#9c27b0','#f44336','#ff9800','#00bcd4'];
                      let hash = 0;
                      for (let c = 0; c < (act.actor || '').length; c++) hash = (act.actor || '').charCodeAt(c) + ((hash << 5) - hash);
                      const bg = COLORS[Math.abs(hash) % COLORS.length];
                      return (
                        <div key={act.id ?? i} className="mob-notif-item" style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 16px',
                          borderBottom: `0.5px solid ${notifDiv}`,
                          background: notifReadBg,
                          transition: 'background 0.12s',
                        }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {actInit}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: notifText, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>{act.actor}</span>
                              {' '}<span style={{ color: notifMuted }}>{act.action}</span>
                              {act.target && <span style={{ color: '#1a9e6e', fontWeight: 600 }}> {act.target}</span>}
                            </div>
                            {(act.time || act.createdAt || act.timestamp) && (
                              <div style={{ fontSize: 10, color: notifDim, marginTop: 2 }}>
                                {(() => {
                                  const t = act.time || act.createdAt || act.timestamp;
                                  if (!t) return '';
                                  const d = new Date(t);
                                  if (isNaN(d.getTime())) return '';
                                  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
                                  if (diff < 0 || diff < 60) return 'just now';
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
                ) : (
                  mobileBugReports.length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 12, color: notifMuted }}>No bug reports yet</div>
                  ) : (
                    mobileBugReports.map((r, i) => {
                      const sevMeta = { low: { label: 'Low', bg: dark ? '#052e16' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', border: dark ? '#166534' : '#bbf7d0' }, medium: { label: 'Medium', bg: dark ? '#2a1f0a' : '#fffbeb', color: dark ? '#fbbf24' : '#d97706', border: dark ? '#5c3a0a' : '#fde68a' }, high: { label: 'High', bg: dark ? '#2a1a0a' : '#fff7ed', color: dark ? '#fb923c' : '#ea580c', border: dark ? '#5c2a0a' : '#fed7aa' }, critical: { label: 'Critical', bg: dark ? '#2a0d0d' : '#fef2f2', color: dark ? '#f87171' : '#dc2626', border: dark ? '#5c1a1a' : '#fecaca' } };
                      const stMeta = { open: { label: 'Open', bg: dark ? '#2a1a0a' : '#fff7ed', color: dark ? '#fb923c' : '#ea580c', border: dark ? '#5c2a0a' : '#fed7aa' }, in_progress: { label: 'In Progress', bg: dark ? '#2a1f0a' : '#fffbeb', color: dark ? '#fbbf24' : '#d97706', border: dark ? '#5c3a0a' : '#fde68a' }, sent: { label: 'Sent', bg: dark ? '#0d1a2a' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', border: dark ? '#1a3a5c' : '#bfdbfe' }, resolved: { label: 'Resolved', bg: dark ? '#052e16' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', border: dark ? '#166534' : '#bbf7d0' }, dismissed: { label: 'Dismissed', bg: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', border: dark ? '#374151' : '#e5e7eb' } };
                      const sev = sevMeta[r.severity] || sevMeta.high;
                      const st = stMeta[r.status] || stMeta.open;
                      const rName = (r.name && r.name !== r.email && !r.name.includes('@')) ? r.name : (r.email ? r.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '?');
                      const COLORS = ['#1a9e6e','#2196f3','#9c27b0','#f44336','#ff9800','#00bcd4'];
                      let hash = 0; for (let c = 0; c < rName.length; c++) hash = rName.charCodeAt(c) + ((hash << 5) - hash);
                      const avBg = COLORS[Math.abs(hash) % COLORS.length];
                      return (
                        <div key={r._id ?? i} className="mob-notif-item" style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 16px',
                          borderBottom: `0.5px solid ${notifDiv}`,
                          background: r.status === 'open' ? notifUnreadBg : notifReadBg,
                        }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(rName[0] || '?').toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`, letterSpacing: 0.3 }}>{sev.label}</span>
                              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, letterSpacing: 0.3 }}>{st.label}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: notifText, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.page || 'General'}</div>
                            <div style={{ fontSize: 11, color: notifMuted, marginTop: 1 }}>{rName}</div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: notifDim }}>
                              {(() => {
                                const d = new Date(r.createdAt);
                                if (isNaN(d.getTime())) return '';
                                const diff = Math.floor((Date.now() - d.getTime()) / 1000);
                                if (diff < 0 || diff < 60) return 'just now';
                                if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                return `${Math.floor(diff / 86400)}d ago`;
                              })()}
                            </div>
                            {r.status === 'open' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316', marginLeft: 'auto', marginTop: 5 }} />}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: `0.5px solid ${notifBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setMobileNotifOpen(false)}
                  style={{ fontSize: 11, color: '#1a9e6e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  View all in dashboard
                </button>
                <button
                  onClick={() => setMobileNotifOpen(false)}
                  style={{ fontSize: 11, color: notifMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
            background: exportLoading ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
            color: exportLoading ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
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
              background: 'rgba(0,0,0,0.4)',
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
          removeSecureUser();
          sessionStorage.removeItem('hp_authorized');
          window.location.href = 'https://go.hostops.online/';
        }}
        onCancel={() => setLogoutOpen(false)}
      />

      <style>{`
        @media (max-width: 768px) {
          .db-sidebar-desktop { display: none !important; }
          .db-sidebar-mobile-bar { display: flex !important; }
          .db-main { padding-top: 52px !important; }
        }
        @media (min-width: 769px) {
          .db-sidebar-mobile-bar { display: none !important; }
        }
        @keyframes pdf-spin { to { transform: rotate(360deg); } }
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
