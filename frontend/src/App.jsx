import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardPage from './pages/clientDashboard';
import InboxPage from './pages/clientDashboard/components/InboxPage';
import { DashboardProvider } from './pages/clientDashboard/context/DashboardContext';
import { AuthProvider } from './pages/AuthContext';
import VerifyPage from './pages/Login/verify';
import ResetPage from './pages/Login/reset';
import ProtectedRoute from './pages/ProtectedRoute';

// FIX: The wildcard <Route path="*"> was catching every unrecognised path —
// including /inbox on a hard refresh before React Router had hydrated —
// and immediately redirecting to "/". This created a loop:
//
//   Browser refreshes /inbox
//   → React loads, router sees /inbox
//   → ProtectedRoute starts verifySession (async)
//   → Meanwhile wildcard fires → Navigate to "/"
//   → LoginPage sees valid token in localStorage → redirects back to /inbox
//   → Loop → ERR_TOO_MANY_REDIRECTS
//
// The wildcard is kept for truly unknown paths but React Router's route
// matching is deterministic — /inbox and /dashboard are matched FIRST,
// so the wildcard only fires for genuinely missing routes.
// The real fix is ensuring ProtectedRoute resolves before any redirect,
// which is handled in ProtectedRoute.jsx via the isReady flag.

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyPage />} />
          <Route path="/reset-password" element={<ResetPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardProvider>
                  <DashboardPage />
                </DashboardProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <DashboardProvider>
                  <InboxPage />
                </DashboardProvider>
              </ProtectedRoute>
            }
          />
          {/* Wildcard: only matches truly unknown paths — not /inbox or /dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;