import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardPage from './pages/clientDashboard';
import InboxPage from './pages/clientDashboard/components/InboxPage';
import ClientLayout from './pages/clientDashboard/ClientLayout';
import TeamLeaderPage from './pages/clientDashboard/pages/TeamLeaderPage';
import StaffPage from './pages/clientDashboard/pages/StaffPage';
import { DashboardProvider } from './pages/clientDashboard/context/DashboardContext';
import { AuthProvider } from './pages/AuthContext';
import VerifyPage from './pages/Login/verify';
import ResetPage from './pages/Login/reset';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyPage />} />
          <Route path="/reset-password" element={<ResetPage />} />

          {/* ── Authenticated client pages with sidebar ────────── */}
          <Route
            element={
              <DashboardProvider>
                <ClientLayout />
              </DashboardProvider>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/team-leader" element={<TeamLeaderPage />} />
            <Route path="/staff" element={<StaffPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;