import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import OTPInput from '../components/OTPInput';
import ResetPasswordForm from './components/ResetPasswordForm';
import { verifyResetToken, resendReset, resetPassword } from './services/resetService';
import Message from './components/Message';

import bgImage from '../../../assets/bg.png';
import hostOpsLogo from '../../../assets/HostOpsLOGO.png';

import '../Login.css';

const SLIDES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

export default function ResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // We want to capture the email but clear the URL
  const [email] = useState(() => searchParams.get('email') || '');
  
  useEffect(() => {
    if (searchParams.toString()) {
      navigate('/reset-password', { replace: true });
    }
  }, [searchParams, navigate]);

  // Slideshow logic
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Show login panel logic
  const [showLogin, setShowLogin] = useState(window.innerWidth > 768);

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
    return (
      <div className="lp-wrap">
        <div className="lp-card" style={{ padding: '40px', textAlign: 'center', margin: 'auto' }}>
          Missing email parameter.
          <br/>
          <button className="lp-btn" style={{ width: 'auto', marginTop: '20px' }} onClick={() => navigate('/')}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="lp-wrap"
      style={{
        backgroundImage: window.innerWidth > 768 ? `url(${bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100dvh',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .lp-wrap {
            min-height: unset !important;
            height: fit-content !important;
            padding: 0 !important;
            align-items: flex-start !important;
            background: #fff !important;
          }
          html, body, #root {
            height: auto !important;
            min-height: unset !important;
            background: #fff !important;
          }
        }
      `}</style>
      <div className="lp-card">
        {/* ── LEFT: Slideshow Panel ── */}
        <div className="lp-slideshow">
          {SLIDES.map((src, i) => (
            <div
              key={i}
              className={`lp-slide${i === currentSlide ? ' active' : ''}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
          <div className="lp-slide-overlay" />
          <div className="lp-slide-content">
            <div className="lp-slide-logo">
             <img src={hostOpsLogo} alt="HostOps" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
              <span className="lp-slide-brand">HostOps</span>
            </div>
            <div>
              <div className="lp-slide-tagline">
                Your<br /> properties,<br /> <em>always</em><br /> in view.
              </div>
              <p className="lp-slide-sub">Real-time insights for every property you manage.</p>
              <div className="lp-slide-dots">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    className={`lp-slide-dot${i === currentSlide ? ' active' : ''}`}
                    onClick={() => setCurrentSlide(i)}
                  />
                ))}
              </div>
            </div>
          </div>
          {!showLogin && (
            <button className="lp-get-started-btn" onClick={() => setShowLogin(true)}>
              Reset Password
            </button>
          )}
        </div>

        {/* ── RIGHT: Form Panel ── */}
        <div className={`lp-form-panel${showLogin ? ' lp-form-visible lp-form-slide-up' : ' lp-form-hidden'}`} style={!showLogin ? {display:'none'} : {}}>
          
          <div className="lp-logo" style={{ marginBottom: '24px' }}>
            <img src={hostOpsLogo} alt="HostOps" className="lp-logo-mark" style={{ width: '48px', height: '48px' }} />
            <span className="lp-brand" style={{ fontSize: '1.6rem' }}>HostOps</span>
          </div>

          <h1 className="lp-h1" style={{ textAlign: 'center', marginBottom: '8px' }}>Reset your password</h1>
          
          {successMsg && <Message text={successMsg} type="success" />}
          {errorMsg && step === 2 && <Message text={errorMsg} type="error" />}

          {step === 1 ? (
            <div style={{ padding: '0 10px' }}>
              <p className="lp-sub" style={{ textAlign: 'center', marginBottom: '32px' }}>
                Enter the 6-digit code sent to<br/><b>{email}</b>
              </p>
              <OTPInput 
                key={otpVersion}
                length={6} 
                onComplete={handleOtpComplete} 
                isError={status === 'error'} 
                isLoading={status === 'loading'} 
              />
              {status === 'error' && (
                <p style={{color: '#c13515', fontSize: '0.85rem', marginTop: '16px', textAlign: 'center'}}>
                  {errorMsg}
                </p>
              )}
              <div style={{textAlign: 'center', marginTop: '32px'}}>
                <button 
                  onClick={handleResend} 
                  disabled={resendCooldown > 0}
                  className="lp-btn"
                  style={{
                    background: resendCooldown > 0 ? '#f0f5f2' : '#fff', 
                    borderColor: resendCooldown > 0 ? '#e3ede8' : '#0c1c14', 
                    color: resendCooldown > 0 ? '#9ab8a9' : '#0c1c14', 
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    width: 'auto',
                    padding: '10px 24px'
                  }}
                >
                  {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '0 10px' }}>
              <p className="lp-sub" style={{ textAlign: 'center', marginBottom: '32px' }}>
                Choose a strong password — minimum 8 characters.
              </p>
              {!successMsg && <ResetPasswordForm onSubmit={handleResetSubmit} />}
            </div>
          )}

          <a onClick={() => navigate('/')} className="lp-back-home" style={{ cursor: 'pointer', marginTop: 'auto', paddingTop: '32px' }}>
            ← Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
