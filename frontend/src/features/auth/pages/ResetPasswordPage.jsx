import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '../utils/validators';
import authService from '../services/authService';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import '../styles/auth.css';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' }); // type: 'error' | 'success'

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirm: '',
    },
  });

  const passwordValue = watch('password');
  const confirmValue = watch('confirm');

  const showMsg = (text, type = 'error') => {
    setMsg({ text, type });
  };

  const handleResetSubmit = async (data) => {
    setIsLoading(true);
    setMsg({ text: '', type: '' });
    try {
      await authService.resetPassword(email, token, data.password);
      showMsg('Password reset successfully! Redirecting to sign in...', 'success');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Password reset failed';
      showMsg(errorMsg, 'error');
      setIsLoading(false);
    }
  };

  const isValidParams = email && token;

  return (
    <div className="rs-wrap">
      <div className="rs-card">
        <h1 className="rs-h1">Set your new password</h1>
        <p className="rs-sub">Choose a strong password (at least 8 characters).</p>
        
        {/* Error / Success Notifications */}
        {(!isValidParams || msg.text) && (
          <div className={`rs-msg ${!isValidParams ? 'error' : msg.type}`}>
            {!isValidParams ? 'Invalid or expired reset link.' : msg.text}
          </div>
        )}

        {/* Render Form only if link params are valid */}
        {isValidParams && (
          <form onSubmit={handleSubmit(handleResetSubmit)} autoComplete="off">
            <div>
              <Input
                label="New password"
                type="password"
                id="reset-password"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register('password')}
              />
              <PasswordStrengthIndicator password={passwordValue} confirmPassword={confirmValue} />
            </div>

            <Input
              label="Confirm password"
              type="password"
              id="reset-confirm"
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register('confirm')}
            />

            <Button type="submit" isLoading={isLoading} className="rs-btn">
              Reset Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
