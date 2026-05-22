import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import Message from './components/Message';
import Logo from './components/Logo';
import Tabs from './components/Tabs';
import './Login.css';

const VIEWS = { LOGIN: 'login', REGISTER: 'register', FORGOT: 'forgot' };

export default function LoginPage() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [message, setMessage] = useState({ text: '', type: '' });

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

        {view !== VIEWS.FORGOT && (
          <Tabs active={view} onChange={handleViewChange} />
        )}

        <Message text={message.text} type={message.type} />

        {view === VIEWS.LOGIN && (
          <LoginForm
            showMsg={showMsg}
            hideMsg={hideMsg}
            onForgot={() => handleViewChange(VIEWS.FORGOT)}
          />
        )}

        {view === VIEWS.REGISTER && (
          <RegisterForm
            showMsg={showMsg}
            hideMsg={hideMsg}
            onSuccess={() => handleViewChange(VIEWS.LOGIN)}
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