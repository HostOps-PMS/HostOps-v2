import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { verifySession } from './apiService';

const HP_LOGIN_URL = import.meta.env.VITE_LOGIN_URL || '/';

/**
 * Wraps routes that require authentication.
 * Verifies the stored token on mount; redirects to login if invalid.
 */
export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    verifySession(auth).then((user) => {
      if (user) {
        setStatus('ok');
      } else {
        setStatus('denied');
      }
    });
  }, [auth]);

  if (status === 'checking') {
    return (
      <div className="hp-spinner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeDashoffset="0">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        Verifying session…
      </div>
    );
  }

  if (status === 'denied') {
    window.location.href = HP_LOGIN_URL;
    return null;
  }

  return children;
}