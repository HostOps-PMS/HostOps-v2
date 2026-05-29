import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import LoginPage     from './pages/Login';
import Dashboard     from './pages/dashboard';
import Clients       from './pages/clients';
import Staffs        from './pages/Staffs/index';
import ClientAccount from './pages/clientAccount/index'; // ← NEW
import AuthorizationModal from './pages/authorization';
import TeamLeaderLayout from './pages/TeamLeader/index';
import TeamLeaderStaffs from './pages/TeamLeader/staffs/index';
import TeamLeaderDashboardPlaceholder from './pages/TeamLeader/dashboard/index';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174';

// ── Consume _t / _u URL params injected by the frontend login app ──────────
(function consumeLoginParams() {
  const params = new URLSearchParams(window.location.search);
  const token   = params.get('_t');
  const userRaw = params.get('_u');
  if (token)   sessionStorage.setItem('hp_access_token', token);
  if (userRaw) sessionStorage.setItem('hp_user', userRaw);
  if (token || userRaw) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw);
      if (parsed.role === 'client') {
        window.location.href = `${FRONTEND_URL}/dashboard`;
        return;
      }
    } catch (e) {
      // ignore parse errors
    }
  }
})();

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  if (!token) return <Navigate to="/login" replace />;
  
  try {
    const user = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    if (user.role === 'team_leader') {
      return <Navigate to="/team-leader/staffs" replace />;
    }
    if (user.role === 'client') {
      window.location.href = `${FRONTEND_URL}/dashboard`;
      return null;
    }
  } catch (e) {
    // ignore
  }

  return children;
}

function TeamLeaderRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  if (!token) return <Navigate to="/login" replace />;
  
  try {
    const user = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    if (user.role !== 'team_leader') {
      return <Navigate to="/dashboard" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const [authorized, setAuthorized] = useState(
    () => !!sessionStorage.getItem('hp_authorized')
  );

  function handleAuthorized() {
    sessionStorage.setItem('hp_authorized', '1');
    setAuthorized(true);
  }

  return (
    <BrowserRouter>
      {!authorized && (
        <AuthorizationModal onAuthorized={handleAuthorized} />
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/clients"
          element={
            <PrivateRoute>
              <Clients />
            </PrivateRoute>
          }
        />

        <Route
          path="/staffs"
          element={
            <PrivateRoute>
              <Staffs />
            </PrivateRoute>
          }
        />

        {/* ── NEW: Client Accounts ─────────────────────────────── */}
        <Route
          path="/client-accounts"
          element={
            <PrivateRoute>
              <ClientAccount />
            </PrivateRoute>
          }
        />

        {/* Team Leader Routes */}
        <Route
          path="/team-leader"
          element={
            <TeamLeaderRoute>
              <TeamLeaderLayout />
            </TeamLeaderRoute>
          }
        >
          <Route path="dashboard" element={<TeamLeaderDashboardPlaceholder />} />
          <Route path="staffs" element={<TeamLeaderStaffs />} />
          <Route index element={<Navigate to="staffs" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}