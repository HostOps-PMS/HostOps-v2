import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside style={{
      width: '240px',
      background: '#f8fbf9',
      borderRight: '1px solid #e3ede8',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: 'calc(100vh - 70px)'
    }}>
      <NavLink
        to="/dashboard"
        style={({ isActive }) => ({
          display: 'block',
          padding: '12px 16px',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '0.9rem',
          color: isActive ? '#0c1c14' : '#6a8b7c',
          background: isActive ? '#fff' : 'transparent',
          boxShadow: isActive ? '0 4px 12px rgba(12, 28, 20, 0.03)' : 'none',
          border: isActive ? '1.5px solid #e3ede8' : '1.5px solid transparent'
        })}
      >
        Dashboard
      </NavLink>
    </aside>
  );
};

export default Sidebar;
