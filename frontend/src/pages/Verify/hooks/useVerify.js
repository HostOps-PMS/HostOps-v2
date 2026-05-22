import { useState, useEffect, useRef } from 'react';
import { verifyEmail } from '../services/verifyService';

export function useVerify(email, token) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error' | 'connection_error'
  const [errorMessage, setErrorMessage] = useState('');
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // Prevent duplicate firing in React StrictMode
    if (verificationAttempted.current) return;

    if (!email || !token) {
      setStatus('error');
      setErrorMessage('This verification link is missing required information.');
      return;
    }

    const verify = async () => {
      verificationAttempted.current = true;
      try {
        await verifyEmail(email, token);
        setStatus('success');
      } catch (err) {
        const msg = err.message || 'This link may have expired. Please try registering again.';
        if (msg === 'Failed to fetch' || msg.includes('Network')) {
          setStatus('connection_error');
        } else {
          setStatus('error');
          setErrorMessage(msg);
        }
      }
    };

    verify();
  }, [email, token]);

  return { status, errorMessage };
}
