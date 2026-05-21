import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/authService';
import AuthLayout from '../../../components/layout/AuthLayout';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ForgotPasswordForm from '../components/ForgotPasswordForm';
import '../styles/auth.css';

const LoginPage = ({ defaultTab = 'login' }) => {
  const { login, register, isAuthenticated, loading, user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(defaultTab); // 'login' | 'register' | 'forgot'
  const [authLoading, setAuthLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' }); // type: 'error' | 'success'

  const showMsg = (text, type = 'error') => {
    setMsg({ text, type });
    if (type === 'success') {
      setTimeout(() => {
        setMsg({ text: '', type: '' });
      }, 8000);
    }
  };

  const clearMsg = () => {
    setMsg({ text: '', type: '' });
  };

  const handleLoginSubmit = async (data) => {
    setAuthLoading(true);
    clearMsg();
    try {
      await login(data.email, data.password);
      showMsg('Welcome back! Redirecting...', 'success');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 800);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Login failed';
      showMsg(errorMsg, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (data) => {
    setAuthLoading(true);
    clearMsg();
    try {
      await register(data);
      showMsg('Account created! Check your email for a verification link before signing in.', 'success');
      setActiveTab('login');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Registration failed';
      showMsg(errorMsg, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (email) => {
    setAuthLoading(true);
    clearMsg();
    try {
      const response = await authService.forgotPassword(email);
      showMsg(response.message || 'Check your email for a reset link!', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Something went wrong. Please try again.';
      showMsg(errorMsg, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    clearMsg();
  };

  if (isAuthenticated) {
    return (
      <AuthLayout>
        <div className="lp-row">
          <h1 className="lp-h1">Welcome back</h1>
          <p className="lp-sub">
            Signed in as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.email})
          </p>
          <div className="lp-msg success show">
            Successfully authenticated.
          </div>
          <button className="lp-btn" onClick={logout} style={{ marginTop: '16px' }}>
            Sign Out
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* Tab Selectors (only show if not in forgot password mode) */}
      {activeTab !== 'forgot' && (
        <div className="lp-tabs">
          <button
            className={`lp-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Sign In
          </button>
          <button
            className={`lp-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Message Notifications */}
      {msg.text && (
        <div className={`lp-msg ${msg.type} show`}>
          {msg.text}
        </div>
      )}

      {/* Render Dynamic Rows */}
      {activeTab === 'login' && (
        <LoginForm
          onSubmit={handleLoginSubmit}
          isLoading={authLoading}
          onForgotPasswordClick={() => handleTabChange('forgot')}
        />
      )}

      {activeTab === 'register' && (
        <RegisterForm
          onSubmit={handleRegisterSubmit}
          isLoading={authLoading}
        />
      )}

      {activeTab === 'forgot' && (
        <ForgotPasswordForm
          onSubmit={handleForgotPasswordSubmit}
          isLoading={authLoading}
          onBackToLoginClick={() => handleTabChange('login')}
        />
      )}

      <a href="https://hostops.online/" className="lp-back-home">
        ← Back to homepage
      </a>
    </AuthLayout>
  );
};

export default LoginPage;
