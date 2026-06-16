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
import { verifyOtp, resendOtp, sendLoginOtp, verifyTotp } from '../services/authService';
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
      sessionStorage.setItem('hp_user', userRaw);
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
  const [message, setMessage]               = useState(null);
  const otpSentRef                          = useRef(false); 

  // 1. Bootstrap session from URL params (_t / _u) if present.
  //    Must run synchronously before sendLoginOtp so getAdminEmail()
  //    can read hp_user from sessionStorage.
  // 2. Auto-send OTP only for email-only users. TOTP users choose their
  //    method first; the OTP is sent when they explicitly pick Email OTP.
  useEffect(() => {
    bootstrapSessionFromUrlParams();

    // Read totpEnabled after bootstrapping — hp_user may have just been set from URL params.
    const hasTotpEnabled = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('hp_user') || '{}').totpEnabled ?? false;
      } catch { return false; }
    })();

    if (!otpSentRef.current && !hasTotpEnabled) {
      otpSentRef.current = true;
      sendLoginOtp().catch((err) => {
        console.error('Failed to send initial login OTP:', err);
      });
    }
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
      const data = await verifyOtp(otp);
      // OTP verification issues a new token + session key — store both
      if (data?.accessToken) setToken(data.accessToken);
      if (data?.sk)          setSessionKey(data.sk);
      showMessage('Code verified! Redirecting…', 'success');
      setTimeout(() => onAuthorized(), 600);
      return true;
    } catch (err) {
      showMessage(err.message ?? 'Invalid code. Please try again.');
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
      const u = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
      return u.email || u.businessEmail || '';
    } catch { return ''; }
  })();

  const totpEnabled = (() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('hp_user') || '{}');
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
      showMessage(err.message ?? 'Invalid code. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { loading, resendLoading, resendCooldown, message, submit, resend, sendOtp, userEmail, totpEnabled, submitTotp };
}