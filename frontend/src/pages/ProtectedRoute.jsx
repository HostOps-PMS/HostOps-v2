import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import FetchingOverlay from './clientDashboard/components/FetchingOverlay';

/**
 * Wraps routes that require authentication.
 *
 * How it works on every page refresh:
 * 1. Renders "checking" spinner immediately (blocks children from mounting).
 * 2. Waits for auth.isReady — set only after AuthContext's hydrate() finishes
 *    its POST /auth/refresh call and writes the new token to accessTokenRef.
 * 3. Checks auth.getToken(). If a token exists, the user is authenticated —
 *    set status='ok' and render children. No second /auth/me call needed
 *    because hydrate() already validated the session against the server.
 * 4. If no token (refresh failed or no cookie), set status='denied' → redirect.
 *
 * WHY we removed verifySession() from here:
 * The old flow was: hydrate() gets token → ProtectedRoute calls verifySession()
 * → verifySession() calls /auth/me. This is a redundant round-trip. hydrate()
 * already proved the session is valid (the server issued a new token). Calling
 * /auth/me again just adds latency and an extra failure point.
 *
 * If /auth/me fails for some reason, authFetch() inside the dashboard will
 * handle it with its own 401 → tryRefresh → retry logic.
 */
export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    // Block until AuthContext hydration is complete.
    // isReady flips to true in the finally{} of hydrate(), guaranteeing
    // accessTokenRef.current is already set before we read it here.
    if (!auth.isReady) return;

    const token = auth.getToken();

    // hydrate() already called /auth/refresh successfully to get this token.
    // That IS the session validation — no need for an extra /auth/me call.
    // If the token is null, refresh failed (bad/missing cookie) → deny.
    if (token) {
      setStatus('ok');
    } else {
      setStatus('denied');
    }
  }, [auth.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'denied') {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Keep the overlay in the React tree so it can play its fade-out animation
  // while the dashboard mounts and begins its own loading overlay.
  // When status flips to 'ok', isVisible=false triggers the exit animation
  // and children render simultaneously — producing a smooth crossfade.
  return (
    <>
      <FetchingOverlay isVisible={status === 'checking'} message="Verifying session…" />
      {status === 'ok' ? children : null}
    </>
  );
}