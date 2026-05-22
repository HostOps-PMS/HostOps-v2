import { useState, useEffect } from 'react';
import { checkSession } from '../services/authService';

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/dashboard';

export function useAutoRedirect() {
  useEffect(() => {
    checkSession().then((isValid) => {
      if (isValid) window.location.href = DASHBOARD_URL;
    });
  }, []);
}

export function useAuthSubmit(asyncFn, { onSuccess, onError, resetOnSuccess = false } = {}) {
  const [loading, setLoading] = useState(false);

  const submit = async (formData) => {
    setLoading(true);
    try {
      const result = await asyncFn(formData);
      onSuccess?.(result);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading };
}