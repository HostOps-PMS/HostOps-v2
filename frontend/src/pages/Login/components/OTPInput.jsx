import { useState, useRef } from 'react';
import './OTPInput.css';

export default function OTPInput({ length = 6, onComplete, isError, isLoading }) {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const inputs = useRef([]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (isNaN(val)) return;

    const newOtp = [...otp];
    // Allow only the last entered char if they somehow typed multiple
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (val && index < length - 1 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
    }

    // Check if complete
    const combined = newOtp.join('');
    if (combined.length === length) {
      onComplete(combined);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputs.current[index - 1]) {
        inputs.current[index - 1].focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0 && inputs.current[index - 1]) {
      inputs.current[index - 1].focus();
    }
    if (e.key === 'ArrowRight' && index < length - 1 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length).replace(/\D/g, '');
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < length; i++) {
        if (pastedData[i]) newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      const nextIndex = Math.min(pastedData.length, length - 1);
      if (inputs.current[nextIndex]) inputs.current[nextIndex].focus();

      if (pastedData.length === length) {
        onComplete(newOtp.join(''));
      }
    }
  };

  // Check for success outline (fully filled but no error)
  const isFilled = otp.join('').length === length;
  const showSuccess = isFilled && !isError && !isLoading;

  return (
    <div className={`otp-container ${isError ? 'otp-error shake' : ''} ${showSuccess ? 'otp-success' : ''}`}>
      {otp.map((data, index) => (
        <input
          key={index}
          className="otp-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength="1"
          value={data}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          ref={(el) => (inputs.current[index] = el)}
          disabled={isLoading}
        />
      ))}
    </div>
  );
}
