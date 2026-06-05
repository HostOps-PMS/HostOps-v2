import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import AccountSettingsModal from './dashboard/components/AccountSettingsModal';
import { logoutUser } from './authorization/services/authService';

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
    children: [
      {
        icon: (
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="6" cy="7" r="3" />
            <circle cx="14" cy="7" r="3" />
            <path d="M1 18c0-2.761 2.239-5 5-5h2" strokeLinecap="round" />
            <path d="M10 13h4a5 5 0 015 5" strokeLinecap="round" />
          </svg>
        ),
        label: 'Staffs',
        to: '/staffs',
      },
    ],
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
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" fill="white" />
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

/* ─── Main Sidebar ──────────────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  });

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
            background: '#1a9e6e',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
            onClick={async () => {
              await logoutUser();
              sessionStorage.removeItem('hp_access_token');
              sessionStorage.removeItem('hp_user');
              sessionStorage.removeItem('hp_authorized');
              window.location.href = 'http://localhost:5173/login';
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
          <div style={{ width: 28, height: 28, background: '#1a9e6e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogoIcon />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>HostOps</span>
        </div>
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