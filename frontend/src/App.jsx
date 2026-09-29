import React, { StrictMode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
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

// Last-resort guard: a render error anywhere below shows a recovery message
// instead of unmounting the whole app into a blank page.
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Something went wrong.</h2>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StrictMode>
        <ErrorBoundary>
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
        </ErrorBoundary>
        </StrictMode>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;