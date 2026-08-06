import { NavLink } from 'react-router';
import { logoutUser } from '../../authorization/services/authService';
import { FaUsers, FaChartLine, FaSignOutAlt, FaCog } from "react-icons/fa";
import { removeSecureUser } from "../../../lib/secureUserStorage";

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
    to: '/team-leader/dashboard',
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
    to: '/team-leader/staffs',
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
    to: '/team-leader/settings',
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
        <span className="db-sidebar__logo-text">Team Leader</span>
      </div>

      {/* Main Nav */}
      <nav className="db-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `db-nav-item${isActive ? " db-nav-item--active" : ""}`
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
              `db-nav-item${isActive ? " db-nav-item--active" : ""}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <button
          className="db-nav-item"
          onClick={async () => {
            await logoutUser();
            sessionStorage.removeItem("hp_access_token");
            removeSecureUser();
            sessionStorage.removeItem("hp_authorized");
            // Redirect to frontend login
            window.location.href = `${import.meta.env.VITE_FRONTEND_URL || 'https://go.hostops.online'}/login`;
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M13 15l4-5-4-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M17 10H7" strokeLinecap="round" />
            <path
              d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3"
              strokeLinecap="round"
            />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
