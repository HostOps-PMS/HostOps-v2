import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import LoginOTPForm from './components/LoginOTPForm';
import PropertySelectForm from './components/PropertySelectForm';
import DomainLoginForm from './components/DomainLoginForm';
import Message from './components/Message';
import Logo from './components/Logo';
import './Login.css';

const VIEWS = {
  LOGIN:           'login',
  FORGOT:          'forgot',
  LOGIN_OTP:       'login_otp',
  PROPERTY_SELECT: 'property_select',
  DOMAIN_LOGIN:    'domain_login',
};

export default function LoginPage() {
  const [view,    setView]    = useState(VIEWS.LOGIN);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [otpData, setOtpData] = useState({ email: '', rememberMe: false });

  // Stores the full auth payload returned after successful OTP verification.
  // Passed down to subsequent screens (PropertySelectForm, DomainLoginForm)
  // so they have access to the user object without re-fetching.
  const [authData, setAuthData] = useState(null);

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

        {/* ── Sign-in ── */}
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

        {/* ── OTP / Device verification ── */}
        {view === VIEWS.LOGIN_OTP && (
          <LoginOTPForm
            email={otpData.email}
            rememberMe={otpData.rememberMe}
            showMsg={showMsg}
            hideMsg={hideMsg}
            onBack={() => handleViewChange(VIEWS.LOGIN)}
            onOTPSuccess={(data) => {
              // Store auth data so subsequent steps can access user info
              setAuthData(data);
              showMsg(
                `Welcome, ${data.user.firstName}! Please select your properties.`,
                'success'
              );
              setView(VIEWS.PROPERTY_SELECT);
            }}
          />
        )}

        {/* ── Property selection ── */}
        {view === VIEWS.PROPERTY_SELECT && (
          <PropertySelectForm
            userData={authData?.user}
            showMsg={showMsg}
            hideMsg={hideMsg}
            onContinue={() => {
              hideMsg();
              setView(VIEWS.DOMAIN_LOGIN);
            }}
            onBack={() => handleViewChange(VIEWS.LOGIN)}
          />
        )}

        {/* ── Domain login ── */}
        {view === VIEWS.DOMAIN_LOGIN && (
          <DomainLoginForm
            userData={authData?.user}
            showMsg={showMsg}
            hideMsg={hideMsg}
            onBack={() => {
              hideMsg();
              setView(VIEWS.PROPERTY_SELECT);
            }}
          />
        )}

        {/* ── Forgot password ── */}
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