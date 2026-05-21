import React from 'react';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '40px', background: '#fff' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0c1c14',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            Dashboard
          </h1>
          <p style={{ color: '#6a8b7c', marginBottom: '32px' }}>
            Welcome back to your live HostPilot property dashboard.
          </p>

          <div style={{
            background: '#f8fbf9',
            border: '1.5px solid #e3ede8',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '600px'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2a4e3c', marginBottom: '20px' }}>
              Account Information
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6a8b7c', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Full Name
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0c1c14' }}>
                  {user?.firstName} {user?.lastName}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6a8b7c', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Email Address
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0c1c14' }}>
                  {user?.email}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6a8b7c', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  User ID
                </span>
                <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: '#6a8b7c' }}>
                  {user?.id || user?._id || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
