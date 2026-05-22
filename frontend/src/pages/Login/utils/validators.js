export const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letters');
  if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letters');
  if (!/[0-9]/.test(password)) errors.push('Must contain numbers');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain special characters');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRegistration = (fields) => {
  const errors = {};
  
  if (!fields.firstName || fields.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }
  if (!fields.lastName || fields.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!fields.email || !emailRegex.test(fields.email)) {
    errors.email = 'Invalid email address format';
  }
  
  const passwordValidation = validatePassword(fields.password || '');
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0]; // Show first error
  }
  
  if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
