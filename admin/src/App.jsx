import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { NotificationsProvider } from './context/NotificationsContext';
import ToastContainer from './components/ToastContainer';
import Dashboard     from './pages/dashboard';
import Clients       from './pages/clients';
import Staffs        from './pages/Staffs/index';
import TeamLeaders from './pages/team-leaders/index';
import AuthorizationModal from './pages/authorization';
import TeamLeaderLayout from './pages/TeamLeader/index';
import TeamLeaderStaffs from './pages/TeamLeader/staffs/index';
import TeamLeaderDashboardPlaceholder from './pages/TeamLeader/dashboard/index';
import AccountsPage from './pages/Accounts/index';
import ActivityLogsPage from './pages/ActivityLogs/index';
import ErrorPage404 from './pages/ErrorPage404';

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
    // ── Clear any previous authorization so the OTP gate always fires
    // for a fresh login, even if the user had already passed it before.
    sessionStorage.removeItem('hp_authorized');
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
  if (!token) { return <ErrorPage404 />; }
  
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
  if (!token) { return <ErrorPage404 />; }

  try {
    const user = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    if (user.role !== 'team_leader') {
      return <Navigate to="/dashboard" replace />;
    }
  } catch (e) {
    return <ErrorPage404 />;
  }

  return children;
}

// ── /admin entry-point redirect ───────────────────────────────────────────
// consumeLoginParams() already stored token + user into sessionStorage before
// React mounted. This component just resolves the correct landing page per role.
// The AuthorizationModal OTP gate renders above all routes and blocks the UI
// until the user passes it — so no content is shown before verification.
function AdminEntryRedirect() {
  const token = sessionStorage.getItem('hp_access_token');
  if (!token) { return <ErrorPage404 />; }
  try {
    const user = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    if (user.role === 'team_leader') return <Navigate to="/team-leader/staffs" replace />;
    return <Navigate to="/dashboard" replace />;
  } catch {
    return <ErrorPage404 />;
  }
}

// ── Roles that must pass the AuthorizationModal OTP gate ──────────────────
// 'client' is intentionally excluded — they are redirected to the frontend
// app above and never reach this point.
const ROLES_REQUIRING_AUTH = new Set(['admin', 'team_leader']);

function getRoleFromSession() {
  try {
    const raw = sessionStorage.getItem('hp_user');
    if (!raw) return null;
    return JSON.parse(raw)?.role ?? null;
  } catch {
    return null;
  }
}

export default function App() {
  const [authorized, setAuthorized] = useState(() => {
    // Already passed the gate in this session
    if (sessionStorage.getItem('hp_authorized')) return true;

    const role = getRoleFromSession();

    // No token / no user yet (e.g. /login route) — skip the gate
    if (!sessionStorage.getItem('hp_access_token') || !role) return true;

    // Roles that don't need the OTP gate pass straight through
    if (!ROLES_REQUIRING_AUTH.has(role)) return true;

    return false;
  });

  function handleAuthorized() {
    sessionStorage.setItem('hp_authorized', '1');
    setAuthorized(true);
  }

  return (
    <BrowserRouter>
      <NotificationsProvider>
      <ToastContainer />
      {!authorized && (
        <AuthorizationModal onAuthorized={handleAuthorized} />
      )}

      <Routes>
        {/* ── Entry point from the login app cross-origin redirect ── */}
        <Route path="/admin" element={<AdminEntryRedirect />} />

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

        {/* ── Team Leaders (admin view) ─────────────────────────── */}
        <Route
          path="/team-leaders"
          element={
            <PrivateRoute>
              <TeamLeaders />
            </PrivateRoute>
          }
        />

        {/* ── Accounts page (admin view) ───────────────────────── */}
        <Route
          path="/accounts"
          element={
            <PrivateRoute>
              <AccountsPage />
            </PrivateRoute>
          }
        />

        {/* ── Activity Logs page (admin view) ─────────────────── */}
        <Route
          path="/activity-logs"
          element={
            <PrivateRoute>
              <ActivityLogsPage />
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

        <Route
          path="/team-leaders"
          element={
            <PrivateRoute>
              <TeamLeaders />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<AdminEntryRedirect />} />
      </Routes>
      </NotificationsProvider>
    </BrowserRouter>
  );
}