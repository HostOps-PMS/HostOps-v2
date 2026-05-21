import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 40px',
      background: '#fff',
      borderBottom: '1px solid #e3ede8',
      height: '70px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: '#26a676',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: '16px'
        }}>H</div>
        <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0c1c14' }}>HostPilot</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {user ? (
          <>
            <span style={{ fontSize: '0.9rem', color: '#2a4e3c', fontWeight: 600 }}>
              Hi, {user.firstName}!
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                border: '1.5px solid #e3ede8',
                borderRadius: '100px',
                background: 'transparent',
                fontWeight: 700,
                color: '#6a8b7c',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              padding: '8px 20px',
              background: '#26a676',
              color: '#fff',
              borderRadius: '100px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
