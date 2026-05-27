import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, DASHBOARD_URL } from '../services/authService';

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
    if (token) navigate(DASHBOARD_URL, { replace: true });
  }, []);
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
        sessionStorage.setItem('hp_access_token', data.accessToken);
        sessionStorage.setItem('hp_user', JSON.stringify(data.user));
        showMessage(`Welcome back, ${data.user.firstName}! Redirecting...`, 'success');
        setTimeout(() => {
          navigate(DASHBOARD_URL, { replace: true });
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