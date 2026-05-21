import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #eaf8f1 0%, #d4f0e4 100%)',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(4, 14, 9, 0.08)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          background: '#fff0ee',
          color: '#c13515',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 800,
          margin: '0 auto 24px'
        }}>
          !
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: '#0c1c14',
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>
          Page Not Found
        </h1>
        <p style={{
          color: '#6a8b7c',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          marginBottom: '28px'
        }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link
          to="/"
          style={{
            display: 'block',
            padding: '14px',
            background: '#26a676',
            color: '#fff',
            border: 'none',
            borderRadius: '100px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '0.98rem',
            boxShadow: '0 6px 18px rgba(38, 166, 118, 0.3)'
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
