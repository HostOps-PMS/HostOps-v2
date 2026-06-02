import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import AccountSettingsModal from './dashboard/components/AccountSettingsModal';

/* ─── Nav data ───────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="7" r="4" />
        <path d="M2 18c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" strokeLinecap="round" />
      </svg>
    ),
    label: 'Clients',
    to: '/clients',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3a4 4 0 100 8 4 4 0 000-8z" />
        <path d="M2 18a8 8 0 0116 0" strokeLinecap="round" />
        <path d="M10 2l1.5 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5L10 2z" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Team Leaders',
    to: '/team-leaders',
  },
];

/* ─── Icons ─────────────────────────────────────────────────────── */
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M13 15l4-5-4-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 10H7" strokeLinecap="round" />
    <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" strokeLinecap="round" />
  </svg>
);

const LogoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" />
  </svg>
);

const ChevronDown = ({ style }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronsLeft = ({ collapsed }) => (
  <svg
    width="14" height="14" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth="1.8"
    style={{ transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <path d="M11 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Reusable NavLink item ─────────────────────────────────────── */
function SidebarNavLink({ to, icon, label, collapsed }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) => `db-nav-item${isActive ? ' db-nav-item--active' : ''}`}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '10px' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10,
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        letterSpacing: '0.01em',
        transition: 'background 0.15s, color 0.15s',
        background: isActive ? '#e6f4ef' : hovered ? '#f7f7f7' : 'transparent',
        color: isActive ? '#1a9e6e' : hovered ? '#333' : '#777',
        fontWeight: isActive ? 600 : 400,
        boxShadow: isActive ? 'inset 0 0 0 1px rgba(26,158,110,0.15)' : 'none',
        position: 'relative',
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span style={{
              position: 'absolute',
              left: 0, top: '20%',
              height: '60%', width: 3,
              borderRadius: '0 3px 3px 0',
              background: '#1a9e6e',
            }} />
          )}
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>{icon}</span>
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function SidebarButton({ icon, label, onClick, collapsed }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '10px' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        background: hovered ? '#fff1f1' : 'transparent',
        color: hovered ? '#e05555' : '#999',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        transition: 'background 0.15s, color 0.15s',
        letterSpacing: '0.01em',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>{icon}</span>
      {!collapsed && label}
    </button>
  );
}

/* ─── Main Sidebar ──────────────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  });

  const sidebarContent = (isMobile = false) => (
    <aside
      style={{
        width: isMobile ? 260 : collapsed ? 64 : 240,
        minWidth: isMobile ? 260 : collapsed ? 64 : 240,
        background: '#fff',
        border: isMobile ? 'none' : '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: isMobile ? 0 : 16,
        padding: '14px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        height: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: isMobile ? 0 : undefined,
        zIndex: isMobile ? 1000 : undefined,
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {/* Brand + collapse toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '6px 4px 14px' : '6px 8px 14px',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        marginBottom: 8,
        justifyContent: collapsed ? 'center' : 'flex-start',
        position: 'relative',
      }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)',
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <LogoIcon />
        </div>

        {(!collapsed || isMobile) && (
          <>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>HostOps</div>
              <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>Team Plan</div>
            </div>
            <ChevronDown style={{ color: '#bbb', flexShrink: 0 }} />
          </>
        )}

        {!isMobile && <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute',
            bottom: -14,
            right: collapsed ? '50%' : 8,
            transform: collapsed ? 'translateX(50%)' : 'none',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#888',
            padding: 0,
            zIndex: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <ChevronsLeft collapsed={collapsed} />
        </button>}
      </div>

      {/* Main Nav */}
      <nav className="db-sidebar__nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed && !isMobile} />
        ))}
      </nav>

      {/* Spacer — pushes footer to bottom */}
      <div style={{ flex: 1 }} />

      {/* Footer — Settings + Logout always at bottom */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        paddingTop: 10,
        marginTop: 4,
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ fontSize: 10, fontWeight: 600, color: '#ccc', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 10px 4px' }}>
            Account
          </div>
        )}

        <SidebarButton
          icon={
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2h15L16 11V8a6 6 0 00-6-6z" />
              <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
            </svg>
          }
          label="Account Settings"
          collapsed={collapsed && !isMobile}
          onClick={() => setSettingsOpen(true)}
        />

        <SidebarButton
          icon={<LogoutIcon />}
          label="Logout"
          collapsed={collapsed && !isMobile}
          onClick={() => {
            sessionStorage.removeItem('hp_access_token');
            sessionStorage.removeItem('hp_user');
            sessionStorage.removeItem('hp_authorized');
            window.location.href = 'http://localhost:5173/login';
          }}
        />

        {(!collapsed || isMobile) && (() => {
          const initials = [currentUser.firstName, currentUser.lastName].filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
          const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'User';
          const email = currentUser.email || '';
          return (
            <div
              onClick={() => setSettingsOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 10px 4px',
                marginTop: 4,
                borderTop: '0.5px solid rgba(0,0,0,0.06)',
                cursor: 'pointer',
                borderRadius: 10,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a9e6e, #0d7a55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
                <div style={{ fontSize: 10, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
              </div>
            </div>
          );
        })()}
      </div>

    </aside>
  );

  return (
    <>
      <div className="db-sidebar-desktop">
        {sidebarContent(false)}
      </div>

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
          <div style={{ width: 28, height: 28, background: '#1a1a1a', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogoIcon />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>HostOps</span>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.35)',
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

      <style>{`
        @media (max-width: 768px) {
          .db-sidebar-desktop { display: none !important; }
          .db-sidebar-mobile-bar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .db-sidebar-mobile-bar { display: none !important; }
        }
      `}</style>
    </>
  );
}