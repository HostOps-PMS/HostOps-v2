/**
 * authorization/hooks/useAuthorization.js
 * ─────────────────────────────────────────────────────
 * Handles OTP verification and resend logic.
 *
 * Returns:
 *   loading         boolean
 *   resendLoading   boolean
 *   resendCooldown  number   seconds remaining (0 = available)
 *   message         { text, type } | null
 *   submit          (otp: string) => Promise<boolean>
 *   resend          () => void
 */

import { useState, useEffect, useRef } from 'react';
import { verifyOtp, resendOtp, sendLoginOtp, verifyTotp, checkTrustedDevice } from '../services/authService';
import { getSecureUser, setSecureUser } from '../../../lib/secureUserStorage';
import { setToken, setSessionKey } from '../../../lib/authUtils';

const RESEND_COOLDOWN_SEC = 60;

/**
 * Parses _t (accessToken) and _u (user JSON) from the URL query string
 * and persists them to sessionStorage so the rest of the app (including
 * getAdminEmail() in authService.js) can read them without re-parsing.
 *
 * After storing, the params are stripped from the URL to avoid them
 * being bookmarked or leaking via the browser history.
 */
function bootstrapSessionFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('_t');
  const userRaw = params.get('_u');

  if (token) {
    sessionStorage.setItem('hp_access_token', token);
  }

  if (userRaw) {
    try {
      // Validate it's parseable before storing — avoids corrupt sessionStorage.
      JSON.parse(userRaw);
      try {
        setSecureUser(JSON.parse(userRaw));
      } catch (e) {
        setSecureUser(userRaw);
      }
    } catch {
      console.error('[useAuthorization] Failed to parse _u URL param');
    }
  }

  // Clean up URL so token is not exposed in browser history / bookmarks.
  if (token || userRaw) {
    params.delete('_t');
    params.delete('_u');
    const newSearch = params.toString();
    const cleanUrl  = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.replaceState({}, '', cleanUrl);
  }
}

export function useAuthorization(onAuthorized) {
  const [loading, setLoading]               = useState(false);
  const [resendLoading, setResendLoading]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lockoutTimer, setLockoutTimer]     = useState(() => {
    const expiry = localStorage.getItem('hp_otp_lockout');
    if (expiry) {
      const remaining = Math.ceil((parseInt(expiry, 10) - Date.now()) / 1000);
      if (remaining > 0) return remaining;
      localStorage.removeItem('hp_otp_lockout');
    }
    return 0;
  });
  const [message, setMessage]               = useState(null);
  const [rememberMe] = useState(() => {
    const val = sessionStorage.getItem('hp_remember_me') === 'true';
    sessionStorage.removeItem('hp_remember_me');
    return val;
  });
  const otpSentRef                          = useRef(false);

  useEffect(() => {
    if (lockoutTimer <= 0) {
      localStorage.removeItem('hp_otp_lockout');
      return;
    }
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          localStorage.removeItem('hp_otp_lockout');
          setMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // 1. Bootstrap session from URL params (_t / _u) if present.
  //    Must run synchronously before sendLoginOtp so getAdminEmail()
  //    can read hp_user from secure storage.
  // 2. Auto-send OTP only for email-only users. TOTP users choose their
  //    method first; the OTP is sent when they explicitly pick Email OTP.
  useEffect(() => {
    bootstrapSessionFromUrlParams();
  }, []);

  function showMessage(text, type = 'error') {
    setMessage({ text, type });
    if (type === 'success') {
      setTimeout(() => setMessage(null), 6000);
    }
  }

  async function submit(otp) {
    setLoading(true);
    setMessage(null);
    try {
      const data = await verifyOtp(otp, rememberMe);
      // OTP verification issues a new token + session key — store both
      if (data?.accessToken) setToken(data.accessToken);
      if (data?.sk)          setSessionKey(data.sk);
      showMessage('Code verified! Redirecting…', 'success');
      setTimeout(() => onAuthorized(), 600);
      return true;
    } catch (err) {
      if (err.status === 429) {
        const remaining = err.retryAfter || 90;
        setLockoutTimer(remaining);
        localStorage.setItem('hp_otp_lockout', Date.now() + remaining * 1000);
        showMessage('Too many attempts. Please wait.');
      } else {
        showMessage(err.message ?? 'Invalid code. Please try again.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SEC);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    if (otpSentRef.current || resendLoading) return;
    setResendLoading(true);
    setMessage(null);
    try {
      await sendLoginOtp();
      otpSentRef.current = true;
      startCooldown();
    } catch (err) {
      showMessage(err.message ?? 'Failed to send code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  async function resend() {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setMessage(null);
    try {
      await resendOtp();
      showMessage('A new code has been sent to your email.', 'success');
      startCooldown();
    } catch (err) {
      showMessage(err.message ?? 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

const userEmail = (() => {
    try {
      const u = getSecureUser() || {};
      return u.email || u.businessEmail || '';
    } catch { return ''; }
  })();

  const totpEnabled = (() => {
    try {
      const u = getSecureUser() || {};
      return u.totpEnabled ?? false;
    } catch { return false; }
  })();

  async function submitTotp(token) {
    setLoading(true);
    setMessage(null);
    try {
      const data = await verifyTotp(token);
      if (data?.accessToken) setToken(data.accessToken);
      if (data?.sk)          setSessionKey(data.sk);
      showMessage('Code verified! Redirecting…', 'success');
      setTimeout(() => onAuthorized(), 600);
      return true;
    } catch (err) {
      if (err.status === 429) {
        const remaining = err.retryAfter || 90;
        setLockoutTimer(remaining);
        localStorage.setItem('hp_otp_lockout', Date.now() + remaining * 1000);
        showMessage('Too many attempts. Please wait.');
      } else {
        showMessage(err.message ?? 'Invalid code. Please try again.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { loading, resendLoading, resendCooldown, lockoutTimer, message, submit, resend, sendOtp, userEmail, totpEnabled, submitTotp, checkTrusted: checkTrustedDevice };
}