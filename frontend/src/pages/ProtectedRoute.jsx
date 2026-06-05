import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { verifySession } from './apiService';

/**
 * Wraps routes that require authentication.
 *
 * Fix summary:
 * 1. Waits for auth.isReady before doing anything — prevents the race condition
 *    where AuthContext hasn't finished writing the cross-origin token to
 *    localStorage yet when verifySession fires on page refresh.
 *
 * 2. Pre-checks for a token before calling verifySession. If there is no token,
 *    redirect immediately without firing a fetch to /auth/me. This prevents the
 *    "0 B, Pending" request visible in the network tab, which happened because
 *    the fetch was cancelled mid-flight when the premature redirect fired — and
 *    that cancelled fetch was itself the trigger that caused ERR_TOO_MANY_REDIRECTS.
 *
 * 3. Removed the arbitrary setTimeout(100) in favour of the isReady flag, which
 *    is a deterministic signal rather than a fragile time-based guess.
 */
export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    // Wait until AuthContext has finished its hydration pass.
    // isReady becomes true after the ?_t=...&_u=... useEffect in AuthContext runs.
    // On a normal page refresh (no URL params) this is still synchronous-ish —
    // the useEffect fires on the first tick after mount, so isReady becomes true
    // almost immediately. The key point is we never read localStorage before it.
    if (!auth.isReady) return;

    // Guard: if there is no token at all, skip the /auth/me fetch entirely and
    // redirect immediately. This prevents a dangling fetch that gets cancelled
    // by the redirect and shows up as "0 B, Pending" in the network tab.
    const token = auth.getToken();
    if (!token) {
      setStatus('denied');
      return;
    }

    // Token exists — verify it against the server.
    verifySession(auth).then((user) => {
      setStatus(user ? 'ok' : 'denied');
    });
  }, [auth.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'checking') {
    return (
      <div className="hp-spinner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeDashoffset="0">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
        Verifying session…
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />;
  }

  return children;
}