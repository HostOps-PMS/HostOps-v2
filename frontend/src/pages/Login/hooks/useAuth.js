import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSession } from '../services/authservice';

export function useAutoRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    checkSession().then((isValid) => {
      if (isValid) navigate('/dashboard', { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useAuthSubmit(asyncFn, { onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false);

  const submit = async (formData) => {
    setLoading(true);
    try {
      const result = await asyncFn(formData);
      onSuccess?.(result);
    } catch (err) {
      onError?.(err.message, err);
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading };
}