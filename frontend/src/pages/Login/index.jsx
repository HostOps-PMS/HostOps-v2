import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import LoginOTPForm from './components/LoginOTPForm';
import Message from './components/Message';
import bgImage from '../../assets/BG.png';
import './Login.css';

const VIEWS = { LOGIN: 'login', FORGOT: 'forgot', LOGIN_OTP: 'login_otp' };

const SLIDES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

export default function LoginPage() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [otpData, setOtpData] = useState({ email: '', rememberMe: false });
  const [currentSlide, setCurrentSlide] = useState(0);

  const showMsg = (text, type = 'error') => setMessage({ text, type });
  const hideMsg = () => setMessage({ text: '', type: '' });

  const handleViewChange = (nextView) => {
    hideMsg();
    setView(nextView);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="lp-wrap"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: '130%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
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
              <div className="lp-slide-logo-mark">H</div>
              <span className="lp-slide-brand">HostOps</span>
            </div>
            <div>
              <div className="lp-slide-tagline">
                Your<br />properties,<br /><em>always</em><br />in view.
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
        </div>

        {/* ── RIGHT: Form Panel ── */}
        <div className="lp-form-panel">
          <Message text={message.text} type={message.type} />
          {view === VIEWS.LOGIN && (
            <LoginForm
              showMsg={showMsg}
              hideMsg={hideMsg}
              onForgot={() => handleViewChange(VIEWS.FORGOT)}
              onRequiresOtp={(email, rememberMe) => {
                setOtpData({ email, rememberMe });
                handleViewChange(VIEWS.LOGIN_OTP);
                showMsg('Please verify your device to continue.', 'success');
              }}
            />
          )}
          {view === VIEWS.LOGIN_OTP && (
            <LoginOTPForm
              email={otpData.email}
              rememberMe={otpData.rememberMe}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}
          {view === VIEWS.FORGOT && (
            <ForgotPasswordForm
              showMsg={showMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}
          <a href="https://hostops.online/" className="lp-back-home">
            ← Back to homepage
          </a>
        </div>

      </div>
    </div>
  );
}