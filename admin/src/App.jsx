import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './App.css';
import { getSecureUser, setSecureUser } from './lib/secureUserStorage';

import { NotificationsProvider } from './context/NotificationsContext';
import { ThemeProvider } from './context/ThemeContext';
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
import AlertsCenterPage from './pages/AlertsCenter';

import HoneypotDashboard from './pages/HoneypotDashboard';
import RecentActivitiesPage from './pages/RecentActivities/index';
import BugReportsPage from './pages/BugReports/index';
import AnnouncementsPage from './pages/Announcements/index';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

// ── Consume _t / _u URL params injected by the frontend login app ──────────
(function consumeLoginParams() {
  const rawParams = window.location.hash ? window.location.hash.substring(1) : window.location.search;
  const params = new URLSearchParams(rawParams);
  const token   = params.get('_t');
  const userRaw = params.get('_u');
  const rmRaw   = params.get('_rm');
  const skRaw   = params.get('_sk');
  if (token)   sessionStorage.setItem('hp_access_token', token);
  if (skRaw)   sessionStorage.setItem('hp_session_key', skRaw);
  if (rmRaw === 'true') sessionStorage.setItem('hp_remember_me', 'true');
  if (userRaw) {
    try {
      setSecureUser(JSON.parse(userRaw));
    } catch (e) {
      // Just store securely even if parse fails (though login passes valid JSON)
      setSecureUser(userRaw);
    }
  }
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
  if (!token) {
    window.location.href = FRONTEND_URL;
    return null;
  }

  try {
    const user = getSecureUser() || {};
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
  if (!token) {
    window.location.href = FRONTEND_URL;
    return null;
  }

  try {
    const user = getSecureUser() || {};
    if (user.role !== 'team_leader') {
      return <Navigate to="/dashboard" replace />;
    }
  } catch (e) {
    window.location.href = FRONTEND_URL;
    return null;
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
  if (!token) {
    window.location.href = FRONTEND_URL;
    return null;
  }
  try {
    const user = getSecureUser() || {};
    if (user.role === 'team_leader') return <Navigate to="/team-leader/staffs" replace />;
    return <Navigate to="/dashboard" replace />;
  } catch {
    window.location.href = FRONTEND_URL;
    return null;
  }
}

// ── Roles that must pass the AuthorizationModal OTP gate ──────────────────
// 'client' is intentionally excluded — they are redirected to the frontend
// app above and never reach this point.
const ROLES_REQUIRING_AUTH = new Set(['admin', 'team_leader']);

function getRoleFromSession() {
  try {
    const raw = getSecureUser();
    if (!raw) return null;
    return raw?.role ?? null;
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

  // isReady prevents the wildcard <Route path="*"> from firing before React
  // Router has resolved the current path. Without this, on a hard refresh the
  // wildcard can match first and navigate away before the real route renders.
  // Mirrors the fix in frontend/src/pages/ProtectedRoute.jsx.
  const [isReady, setIsReady] = useState(false);
  const readyRef = useRef(false);
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      setIsReady(true);
    }
  }, []);

  function handleAuthorized() {
    sessionStorage.setItem('hp_authorized', '1');
    setAuthorized(true);
  }

  return (
    <BrowserRouter>
      <ThemeProvider>
      <NotificationsProvider>
      <ToastContainer />
      {!authorized && (
        <AuthorizationModal onAuthorized={handleAuthorized} />
      )}

      {authorized && <Routes>
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

        {/* ── Honeypot Security ──────────────────────────────────── */}
        <Route
          path="/honeypot"
          element={
            <PrivateRoute>
              <HoneypotDashboard />
            </PrivateRoute>
          }
        />

        {/* ── Alerts Center ────────────────────────────────────── */}
        <Route
          path="/alerts"
          element={
            <PrivateRoute>
              <AlertsCenterPage />
            </PrivateRoute>
          }
        />

        {/* ── Recent Activities ─────────────────────────────────── */}
        <Route
          path="/recent-activities"
          element={
            <PrivateRoute>
              <RecentActivitiesPage />
            </PrivateRoute>
          }
        />

        {/* ── Bug Reports ────────────────────────────────────── */}
        <Route
          path="/bug-reports"
          element={
            <PrivateRoute>
              <BugReportsPage />
            </PrivateRoute>
          }
        />

        {/* ── Announcements ─────────────────────────────────── */}
        <Route
          path="/announcements"
          element={
            <PrivateRoute>
              <AnnouncementsPage />
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

        {/* Only render the wildcard after the initial route resolution settles,
            so it doesn't fire before real routes have had a chance to match. */}
        {isReady && <Route path="*" element={<AdminEntryRedirect />} />}
      </Routes>}
      </NotificationsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}