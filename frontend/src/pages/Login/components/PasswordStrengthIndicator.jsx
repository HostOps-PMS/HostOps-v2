import React from 'react';
import './PasswordStrengthIndicator.css';

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="indicator-icon met-icon">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="indicator-icon unmet-icon">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PasswordStrengthIndicator = ({ password = '', confirmPassword = '' }) => {
  const requirements = [
    { label: "At least 8 characters", test: (p) => p.length >= 8 },
    { label: "Lowercase letters (a-z)", test: (p) => /[a-z]/.test(p) },
    { label: "Uppercase letters (A-Z)", test: (p) => /[A-Z]/.test(p) },
    { label: "Numbers (0-9)", test: (p) => /[0-9]/.test(p) },
    { label: "Special characters (!@#$%^&*...)", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ];

  const allValid = requirements.every((rule) => rule.test(password));
  const metCount = requirements.filter((rule) => rule.test(password)).length;
  
  const showMatch = confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword && password.length > 0;

  return (
    <div className="password-strength-container">
      {password.length > 0 && (
        <div className="password-strength-bar">
          <div
            className={`password-strength-fill strength-${metCount}`}
            style={{ width: `${(metCount / requirements.length) * 100}%` }}
          />
        </div>
      )}

      {password.length > 0 && (
        <ul className="password-requirements">
          {requirements.map((rule, index) => {
            const isValid = rule.test(password);
            return (
              <li key={index} className={`requirement ${isValid ? 'met' : 'unmet'}`}>
                {isValid ? <CheckIcon /> : <CrossIcon />}
                <span className="requirement-text">{rule.label}</span>
              </li>
            );
          })}
          
          {showMatch && (
            <li className={`requirement ${passwordsMatch && allValid ? 'met' : 'unmet'}`}>
              {passwordsMatch && allValid ? <CheckIcon /> : <CrossIcon />}
              <span className="requirement-text">Passwords match</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
