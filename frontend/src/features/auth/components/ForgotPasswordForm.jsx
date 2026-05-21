import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '../utils/validators';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

const ForgotPasswordForm = ({ onSubmit, isLoading, onBackToLoginClick }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleFormSubmit = (data) => {
    onSubmit(data.email);
  };

  return (
    <div className="lp-row">
      <h1 className="lp-h1">Reset your password</h1>
      <p className="lp-sub">We'll email you a reset link.</p>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Input
          label="Email"
          type="email"
          id="forgot-email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        
        <Button type="submit" isLoading={isLoading}>
          Send Reset Link
        </Button>
        
        <button
          type="button"
          className="lp-link"
          onClick={onBackToLoginClick}
        >
          ← Back to sign in
        </button>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;
