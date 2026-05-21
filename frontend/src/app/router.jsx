import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage';
import EmailVerificationPage from '../features/auth/pages/EmailVerificationPage';
import NotFound from '../pages/NotFound';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root is now the Login Page directly */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />
        <Route path="/verify" element={<EmailVerificationPage />} />

        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
