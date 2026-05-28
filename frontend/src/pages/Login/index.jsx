import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import LoginOTPForm from './components/LoginOTPForm';
import Message from './components/Message';
import Logo from './components/Logo';
import './Login.css';

const VIEWS = { LOGIN: 'login', FORGOT: 'forgot', LOGIN_OTP: 'login_otp' };

export default function LoginPage() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [otpData, setOtpData] = useState({ email: '', rememberMe: false });

  const showMsg = (text, type = 'error') => setMessage({ text, type });
  const hideMsg = () => setMessage({ text: '', type: '' });

  const handleViewChange = (nextView) => {
    hideMsg();
    setView(nextView);
  };

  return (
    <div className="lp-wrap">
      <div className="lp-card">
        <Logo />

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
  );
}