import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/resetService';

/**
 * useResetPassword
 * Handles the reset-password submission flow.
 *
 * @param {{ email: string|null, token: string|null }} params
 * @returns {{ message: {text:string, type:string}|null, handleReset: Function }}
 */
export function useResetPassword({ email, token }) {
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  function showMsg(text, type) {
    setMessage({ text, type });
  }

  async function handleReset(newPassword) {
    try {
      await resetPassword({ email, token, newPassword });
      showMsg('Password reset! Redirecting to sign in…', 'success');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      showMsg(err.message || 'Reset failed. Please try again.', 'error');
    }
  }

  return { message, handleReset };
}
