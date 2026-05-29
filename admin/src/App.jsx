import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import LoginPage  from './pages/Login';
import Dashboard  from './pages/dashboard';
import Clients    from './pages/clients';
import Staffs     from './pages/Staffs/index';
import AuthorizationModal from './pages/authorization';
import TeamLeaderLayout from './pages/TeamLeader/index';
import TeamLeaderStaffs from './pages/TeamLeader/staffs/index';
import TeamLeaderDashboardPlaceholder from './pages/TeamLeader/dashboard/index';

// ── Consume _t / _u URL params injected by the frontend login app ──────────
// This runs synchronously at module load, before any component mounts,
// so sessionStorage is populated before AuthorizationModal fires sendLoginOtp.
(function consumeLoginParams() {
  const params = new URLSearchParams(window.location.search);
  const token   = params.get('_t');
  const userRaw = params.get('_u');
  if (token)   sessionStorage.setItem('hp_access_token', token);
  if (userRaw) sessionStorage.setItem('hp_user', userRaw);
  if (token || userRaw) {
    // Clean the URL immediately so tokens don't linger in browser history
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  if (!token) return <Navigate to="/login" replace />;
  
  // Block team_leaders from main admin routes
  try {
    const user = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    if (user.role === 'team_leader') {
      return <Navigate to="/team-leader/staffs" replace />;
    }
  } catch (e) {
    // ignore
  }

  return children;
}

function TeamLeaderRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  if (!token) return <Navigate to="/login" replace />;
  
  // Only allow team_leaders
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
  // Persist authorization per browser session.
  // Clears automatically when the tab/browser is closed.
  const [authorized, setAuthorized] = useState(
    () => !!sessionStorage.getItem('hp_authorized')
  );

  function handleAuthorized() {
    sessionStorage.setItem('hp_authorized', '1');
    setAuthorized(true);
  }

  return (
    <BrowserRouter>
      {/* Authorization gate — blocks all routes until OTP is verified */}
      {/* {!authorized && (
        <AuthorizationModal onAuthorized={handleAuthorized} />
      )} */}

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

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}