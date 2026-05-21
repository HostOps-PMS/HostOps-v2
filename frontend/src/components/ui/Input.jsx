import React, { forwardRef } from 'react';
import { cn } from '../../utils/helpers';

const Input = forwardRef(({
  label,
  type = 'text',
  error,
  className = '',
  id,
  ...props
}, ref) => {
  return (
    <div className="lp-field">
      {label && <label className="lp-label" htmlFor={id}>{label}</label>}
      <input
        ref={ref}
        type={type}
        id={id}
        className={cn(
          'lp-input',
          error && 'input-error',
          className
        )}
        {...props}
      />
      {error && (
        <span className="error-text" style={{ color: '#c13515', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
