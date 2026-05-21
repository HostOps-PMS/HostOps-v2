import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';

const Home = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fbf9' }}>
      <Navbar />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 800,
          color: '#0c1c14',
          marginBottom: '16px',
          letterSpacing: '-1px'
        }}>
          Welcome to HostPilot
        </h1>
        <p style={{
          fontSize: '1.15rem',
          color: '#6a8b7c',
          maxWidth: '540px',
          lineHeight: 1.6,
          marginBottom: '32px'
        }}>
          The ultimate platform for managing your vacation properties, bookings, and operations from a single dashboard.
        </p>
        <Link
          to="/dashboard"
          style={{
            padding: '16px 36px',
            background: '#26a676',
            color: '#fff',
            borderRadius: '100px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '1rem',
            boxShadow: '0 6px 20px rgba(38, 166, 118, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          Go to Dashboard &rarr;
        </Link>
      </main>
    </div>
  );
};

export default Home;
