import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import OTPInput from '../components/OTPInput';
import ResetPasswordForm from './components/ResetPasswordForm';
import { verifyResetToken, resendReset, resetPassword } from './services/resetService';
import Logo from './components/Logo';
import Message from './components/Message';
import './Reset.css';

export default function ResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email');
  
  const [step, setStep] = useState(1); // 1: OTP, 2: New Password
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  const handleOtpComplete = async (otp) => {
    setStatus('loading');
    setErrorMsg('');
    clearTimeout(errorTimerRef.current);
    try {
      await verifyResetToken(email, otp);
      clearTimeout(errorTimerRef.current);
      setToken(otp); // save for next step
      setStatus('idle');
      setStep(2);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      clearOtpErrorSoon();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendReset(email);
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

  const handleResetSubmit = async (newPassword) => {
    try {
      await resetPassword({ email, token, newPassword });
      setSuccessMsg('Password reset successfully. Redirecting to login...');
      setTimeout(() => navigate('/'), 2000);
    } catch(err) {
      setErrorMsg(err.message);
    }
  };

  if (!email) {
    return <div className="rst-wrap"><div className="rst-card">Missing email parameter.</div></div>;
  }

  return (
    <div className="rst-wrap">
      <div className="rst-card">
        <Logo />
        <h1 className="rst-h1">Reset your password</h1>

        {successMsg && <Message text={successMsg} type="success" />}
        {errorMsg && step === 2 && <Message text={errorMsg} type="error" />}

        {step === 1 ? (
          <>
            <p className="rst-sub">Enter the 6-digit code sent to <b>{email}</b>.</p>
            <OTPInput 
              key={otpVersion}
              length={6} 
              onComplete={handleOtpComplete} 
              isError={status === 'error'} 
              isLoading={status === 'loading'} 
            />
            {status === 'error' && <p style={{color: '#c13515', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center'}}>{errorMsg}</p>}
            <div style={{textAlign: 'center', marginTop: '1rem'}}>
              <button 
                onClick={handleResend} 
                disabled={resendCooldown > 0}
                style={{
                  background: resendCooldown > 0 ? '#e3ede8' : '#eaf8f1', 
                  border: 'none', 
                  color: resendCooldown > 0 ? '#6a8b7c' : '#26a676', 
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', 
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  transition: 'all 0.2s',
                  display: 'inline-block'
                }}
              >
                {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="rst-sub">Choose a strong password — minimum 8 characters.</p>
            {!successMsg && <ResetPasswordForm onSubmit={handleResetSubmit} />}
          </>
        )}
      </div>
    </div>
  );
}
