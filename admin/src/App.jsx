import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import LoginPage from './pages/Login';
import Dashboard from './pages/dashboard';
import Clients   from './pages/clients';

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('hp_access_token');
  // Valid session = any non-empty token (real JWT from backend)
  return token
    ? children
    : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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