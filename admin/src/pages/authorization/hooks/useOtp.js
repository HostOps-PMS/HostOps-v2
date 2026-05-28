/**
 * authorization/hooks/useOtp.js
 * ─────────────────────────────────────────────────────
 * Manages the 6-digit OTP input state.
 *
 * Returns:
 *   digits      string[]   array of 6 single-char strings
 *   otp         string     joined OTP value e.g. "123456"
 *   isComplete  boolean    true when all 6 digits filled
 *   inputRefs   ref        array of input DOM refs
 *   onChange    fn
 *   onKeyDown   fn
 *   onPaste     fn
 *   reset       fn         clears all digits + refocuses box 0
 */

import { useState, useRef } from 'react';

const OTP_LENGTH = 6;

export function useOtp() {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef([]);

  function onChange(index, value) {
    // Keep only the last numeric character typed
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-advance focus
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function onKeyDown(index, e) {
    // Backspace on empty box → move to previous
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function onPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);

    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);

    // Focus the box after the last pasted digit
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }

  function reset() {
    setDigits(Array(OTP_LENGTH).fill(''));
    // Defer so the DOM settles before refocusing
    setTimeout(() => inputRefs.current[0]?.focus(), 0);
  }

  const otp = digits.join('');
  const isComplete = digits.every((d) => d !== '');

  return { digits, otp, isComplete, inputRefs, onChange, onKeyDown, onPaste, reset };
}
