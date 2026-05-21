import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../utils/validators';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

const LoginForm = ({ onSubmit, isLoading, onForgotPasswordClick }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <div className="lp-row">
      <h1 className="lp-h1">Welcome back</h1>
      <p className="lp-sub">Sign in to view your live property dashboard.</p>
      
      <form onSubmit={handleSubmit(handleFormSubmit)} autoComplete="on">
        <Input
          label="Email"
          type="email"
          id="login-email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        
        <Input
          label="Password"
          type="password"
          id="login-password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        
        <Button type="submit" isLoading={isLoading}>
          Sign In
        </Button>
        
        <button
          type="button"
          className="lp-link"
          onClick={onForgotPasswordClick}
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
