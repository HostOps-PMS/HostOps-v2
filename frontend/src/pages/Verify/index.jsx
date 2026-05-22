import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useVerify } from './hooks/useVerify';
import './Verify.css';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  
  // Security protection: Ensure we properly sanitize and read params
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const { status, errorMessage } = useVerify(email, token);

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <>
            <div className="vf-icon success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="vf-h1">Email verified!</h1>
            <p className="vf-p">Your account is now active. You can sign in to access your dashboard.</p>
            <Link to="/" className="vf-btn">
              Sign in &rarr;
            </Link>
          </>
        );

      case 'error':
        return (
          <>
            <div className="vf-icon error">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="vf-h1">Verification failed</h1>
            <p className="vf-p">{errorMessage}</p>
            <Link to="/" className="vf-btn">
              Go to login
            </Link>
          </>
        );

      case 'connection_error':
        return (
          <>
            <div className="vf-icon error">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="vf-h1">Connection error</h1>
            <p className="vf-p">Could not reach the server. Please try again in a moment.</p>
            <button onClick={() => window.location.reload()} className="vf-btn">
              Try again
            </button>
          </>
        );

      case 'loading':
      default:
        return (
          <>
            <div className="vf-icon loading">
              <svg className="vf-spinner" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <h1 className="vf-h1">Verifying your email...</h1>
            <p className="vf-p">Please wait a moment.</p>
          </>
        );
    }
  };

  return (
    <div className="vf-wrap">
      <div className="vf-card">
        {renderContent()}
      </div>
    </div>
  );
}
