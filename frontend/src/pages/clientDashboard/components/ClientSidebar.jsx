import { NavLink } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

const NAV_ITEMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 3a4 4 0 100 8 4 4 0 000-8z" />
        <path d="M2 18a8 8 0 0116 0" strokeLinecap="round" />
        <path d="M10 2l1.5 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5L10 2z" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Team Leader',
    to: '/team-leader',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="7" r="3" />
        <circle cx="14" cy="7" r="3" />
        <path d="M1 18c0-2.761 2.239-5 5-5h2" strokeLinecap="round" />
        <path d="M10 13h4a5 5 0 015 5" strokeLinecap="round" />
      </svg>
    ),
    label: 'Staff',
    to: '/staff',
  },
];

export default function ClientSidebar() {
  const { getUser, clear } = useAuth();
  const user = getUser();

  const handleLogout = () => {
    clear();
    window.location.href = '/';
  };

  return (
    <aside className="cs-sidebar">
      {/* Logo */}
      <div className="cs-sidebar__logo">
        <div className="cs-sidebar__logo-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" fill="white" />
          </svg>
        </div>
        <span className="cs-sidebar__logo-text">HostOps</span>
      </div>

      {/* Main Nav */}
      <nav className="cs-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `cs-nav-item${isActive ? ' cs-nav-item--active' : ''}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="cs-sidebar__footer">
        {/* User info pill */}
        <div className="cs-sidebar__user">
          <div className="cs-sidebar__user-avatar">
            {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="cs-sidebar__user-info">
            <span className="cs-sidebar__user-name">
              {user?.firstName || 'User'} {user?.lastName || ''}
            </span>
            <span className="cs-sidebar__user-email">
              {user?.email || ''}
            </span>
          </div>
        </div>

        <button className="cs-nav-item cs-nav-item--logout" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
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
