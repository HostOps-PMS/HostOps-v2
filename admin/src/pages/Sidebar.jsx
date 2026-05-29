import { NavLink } from 'react-router-dom';

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
    // Person with a sub-badge icon to represent a sub-account
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="6" r="3.5" />
        <path d="M2 17c0-3 2.5-5.5 6-5.5" strokeLinecap="round" />
        <circle cx="15" cy="14" r="3" />
        <path d="M15 12.5v1.5l1 1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Client Accounts',
    to: '/client-accounts',
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
];

const BOTTOM_ITEMS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 2a6 6 0 00-6 6v3l-1.5 2h15L16 11V8a6 6 0 00-6-6z" />
        <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
      </svg>
    ),
    label: 'Settings',
    to: '/settings',
  },
];

export default function Sidebar() {
  return (
    <aside className="db-sidebar">
      {/* Logo */}
      <div className="db-sidebar__logo">
        <div className="db-sidebar__logo-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" />
          </svg>
        </div>
        <span className="db-sidebar__logo-text">AdminPanel</span>
      </div>

      {/* Main Nav */}
      <nav className="db-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `db-nav-item${isActive ? ' db-nav-item--active' : ''}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="db-sidebar__footer">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `db-nav-item${isActive ? ' db-nav-item--active' : ''}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <button
          className="db-nav-item"
          onClick={() => {
            sessionStorage.removeItem('hp_access_token');
            window.location.href = '/login';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 15l4-5-4-5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 10H7" strokeLinecap="round" />
            <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" strokeLinecap="round" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}