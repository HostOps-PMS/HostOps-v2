import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import LoginPage  from './pages/Login';
import Dashboard  from './pages/dashboard';
import Clients    from './pages/clients';
import AuthorizationModal from './pages/authorization';

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  // Valid session = any non-empty token (real JWT from backend)
  return token
    ? children
    : <Navigate to="/login" replace />;
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

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}