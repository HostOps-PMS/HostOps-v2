import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { login, DASHBOARD_URL } from '../services/authService';
import { getSecureUser, setSecureUser } from '../../../lib/secureUserStorage';
import { setSessionKey } from '../../../lib/authUtils';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5174';

/**
 * Redirects to dashboard if a valid JWT token exists in sessionStorage.
 * No backend call — the token presence is enough for redirect on login page.
 */
export function useAutoRedirect() {
  const navigate = useNavigate();
  const didCheck = useRef(false);

  useEffect(() => {
    if (didCheck.current) return;
    didCheck.current = true;

    const token = sessionStorage.getItem('hp_access_token');
    if (token) {
      try {
        const user = getSecureUser() || {};
        if (user.role === 'team_leader') {
          navigate('/team-leader/staffs', { replace: true });
          return;
        }
        if (user.role === 'client') {
          window.location.href = `${FRONTEND_URL}/dashboard`;
          return;
        }
        if (user.role === 'admin') {
          navigate(DASHBOARD_URL, { replace: true });
          return;
        }
      } catch (e) {
        // ignore parse errors
      }
      navigate(DASHBOARD_URL, { replace: true });
    }
  }, [navigate]);
}

/**
 * Returns the display name from a user object.
 * Prefers firstName, falls back to businessName, then email.
 */
function getDisplayName(user) {
  if (user.firstName && user.firstName.trim()) return user.firstName.trim();
  if (user.businessName && user.businessName.trim()) return user.businessName.trim();
  return user.email || 'User';
}

/**
 * Submit handler for login.
 */
export function useAuthSubmit(type, showMessage) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData) {
    setLoading(true);

    try {
      if (type === 'login') {
        const data = await login(formData);

        // Guard: ensure we actually got a user back
        if (!data || !data.user) {
          throw new Error('Unexpected response from server. Please try again.');
        }

        sessionStorage.setItem('hp_access_token', data.accessToken);
        setSecureUser(data.user);
        if (data.sk) setSessionKey(data.sk);

        showMessage(`Welcome back, ${getDisplayName(data.user)}! Redirecting...`, 'success');

        setTimeout(() => {
          if (data.user.role === 'team_leader') {
            navigate('/team-leader/staffs', { replace: true });
          } else if (data.user.role === 'client') {
            window.location.href = `${FRONTEND_URL}/dashboard`;
          } else if (data.user.role === 'admin') {
            navigate(DASHBOARD_URL, { replace: true });
          } else {
            navigate(DASHBOARD_URL, { replace: true });
          }
        }, 800);
      }
    } catch (err) {
      showMessage(err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return { loading, handleSubmit };
}