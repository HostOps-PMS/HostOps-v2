import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import OTPInput from '../components/OTPInput';
import { verifyEmail, resendVerification } from './services/verifyService';
import './Verify.css';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email');
  
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [otpVersion, setOtpVersion] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(60);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    return () => clearTimeout(errorTimerRef.current);
  }, []);

  const clearOtpErrorSoon = () => {
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setStatus('idle');
      setErrorMsg('');
      setOtpVersion((value) => value + 1);
    }, 700);
  };

  const handleComplete = async (otp) => {
    setStatus('loading');
    setErrorMsg('');
    clearTimeout(errorTimerRef.current);
    try {
      await verifyEmail(email, otp);
      clearTimeout(errorTimerRef.current);
      setStatus('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      clearOtpErrorSoon();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerification(email);
      clearTimeout(errorTimerRef.current);
      setStatus('idle');
      setErrorMsg('');
      setOtpVersion((value) => value + 1);
      setResendCooldown(60);
      alert('A new code has been sent to your email.');
    } catch(err) {
      alert(err.message);
    }
  };

  if (!email) {
    return <div className="vf-wrap"><div className="vf-card">Missing email parameter. Return to login.</div></div>;
  }

  return (
    <div className="vf-wrap">
      <div className="vf-card">
        <h1 className="vf-h1">Verify your email</h1>
        <p className="vf-p">We've sent a 6-digit code to <b>{email}</b>. Enter it below to verify your account.</p>
        
        <OTPInput 
          key={otpVersion}
          length={6} 
          onComplete={handleComplete} 
          isError={status === 'error'} 
          isLoading={status === 'loading'} 
        />
        
        {status === 'error' && <p style={{color: '#c13515', fontSize: '0.85rem'}}>{errorMsg}</p>}
        {status === 'success' && (
          <div style={{marginTop: '1rem'}}>
             <div className="vf-icon success" style={{width: 32, height: 32, margin: '0 auto 10px'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{color: '#26a676', fontSize: '0.85rem'}}>Email verified! Redirecting...</p>
          </div>
        )}

        <div style={{marginTop: '2rem', textAlign: 'center'}}>
          <button 
            onClick={handleResend} 
            disabled={resendCooldown > 0}
            style={{
              background: resendCooldown > 0 ? '#f3f4f6' : '#eff6ff', 
              border: 'none', 
              color: resendCooldown > 0 ? '#9ca3af' : '#2563eb', 
              cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', 
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
