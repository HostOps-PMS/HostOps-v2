import { useState } from 'react';

export function useResetSubmit(submitFn, options = {}) {
  const [loading, setLoading] = useState(false);

  const submit = async (...args) => {
    setLoading(true);
    try {
      const data = await submitFn(...args);
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      options.onError?.(err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading };
}
