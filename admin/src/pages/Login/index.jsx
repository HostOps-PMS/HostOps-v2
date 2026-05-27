import { useState } from 'react';

import './Login.css';

import Logo from './components/Logo';
import Message from './components/Message';
import LoginForm from './components/LoginForm';

import { useAutoRedirect } from './hooks/useAuth';

export default function LoginPage() {
  useAutoRedirect();

  const [message, setMessage] = useState({ text: null, type: null });

  function showMessage(text, type = 'error') {
    setMessage({ text, type });
    if (type === 'success') {
      setTimeout(() => setMessage({ text: null, type: null }), 8000);
    }
  }

  return (
    <div className="lp-wrap">
      <div className="lp-card">
        <Logo />

        <Message text={message.text} type={message.type} />

        <LoginForm showMessage={showMessage} />

        <div style={{ textAlign: 'center', padding: '24px 0 0', color: '#c5d8cd', fontSize: '.75rem' }}>
                © 2026 HostOps. All rights reserved.
              </div>
      </div>
    </div>
  );
}