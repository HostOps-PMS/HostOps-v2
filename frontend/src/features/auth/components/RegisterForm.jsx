import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../utils/validators';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const RegisterForm = ({ onSubmit, isLoading }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirm: '',
    },
  });

  const passwordValue = watch('password');
  const confirmValue = watch('confirm');

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <div className="lp-row">
      <h1 className="lp-h1">Create your account</h1>
      <p className="lp-sub">We'll email you a verification link.</p>
      
      <form onSubmit={handleSubmit(handleFormSubmit)} autoComplete="off">
        <Input
          label="First name"
          type="text"
          id="register-firstName"
          error={errors.firstName?.message}
          {...register('firstName')}
        />

        <Input
          label="Last name"
          type="text"
          id="register-lastName"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        
        <Input
          label="Email"
          type="email"
          id="register-email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        
        <div>
          <Input
            label="Password"
            type="password"
            id="register-password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrengthIndicator password={passwordValue} confirmPassword={confirmValue} />
        </div>

        <Input
          label="Confirm password"
          type="password"
          id="register-confirm"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        
        <Button type="submit" isLoading={isLoading}>
          Create Account
        </Button>
      </form>
    </div>
  );
};

export default RegisterForm;