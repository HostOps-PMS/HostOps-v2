import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardPage from './pages/clientDashboard';
import { DashboardProvider } from './pages/clientDashboard/context/DashboardContext';
import { AuthProvider } from './pages/AuthContext';
import VerifyPage from './pages/Verify';
import ResetPasswordPage from './pages/ResetPassword';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <DashboardProvider>
                <DashboardPage />
              </DashboardProvider>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;