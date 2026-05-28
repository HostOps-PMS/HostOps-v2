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

import { useState, useEffect } from 'react';
import { verifyOtp, resendOtp, sendLoginOtp } from '../services/authService';

const RESEND_COOLDOWN_SEC = 60;

export function useAuthorization(onAuthorized) {
  const [loading, setLoading]             = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage]             = useState(null);

  // Send OTP email as soon as the AuthModal mounts.
  // The admin email is read from sessionStorage (set from URL params on redirect).
  useEffect(() => {
    sendLoginOtp().catch((err) => {
      console.error('Failed to send initial login OTP:', err);
    });
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
      await verifyOtp(otp);
      showMessage('Code verified! Redirecting…', 'success');
      // Brief delay so the success message is visible before unmounting
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

  return { loading, resendLoading, resendCooldown, message, submit, resend };
}
