/**
 * authorization/components/AuthModal.jsx
 * ─────────────────────────────────────────────────────
 * Full-screen authorization gate modal.
 * Matches the Login page card UI (same brand colours,
 * fonts, button style, message style).
 *
 * Props:
 *   onAuthorized  () => void
 */

import OtpInput from './OtpInput';
import { useOtp }           from '../hooks/useOtp';
import { useAuthorization } from '../hooks/useAuthorization';

export default function AuthModal({ onAuthorized }) {
  const otp = useOtp();
  const auth = useAuthorization(onAuthorized);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!otp.isComplete || auth.loading) return;
    const success = await auth.submit(otp.otp);
    if (!success) otp.reset();
  }

  return (
    <div className="am-overlay" role="dialog" aria-modal="true" aria-labelledby="am-title">
      <div className="am-card">

        {/* ── Logo ── */}
        <div className="am-logo">
          <div className="am-logo-mark">H</div>
          <div className="am-logo-brand">HostPilot</div>
        </div>

        {/* ── Shield icon ── */}
        <div className="am-icon-wrap" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        {/* ── Heading ── */}
        <h1 className="am-title" id="am-title">Authorization Required</h1>
        <p className="am-sub">
          Enter the <strong>6-digit code</strong> sent to your registered email
          to access the admin panel.
        </p>

        {/* ── Feedback message ── */}
        {auth.message && (
          <div className={`am-msg am-msg--${auth.message.type}`}>
            {auth.message.text}
          </div>
        )}

        {/* ── OTP form ── */}
        <form onSubmit={handleSubmit} autoComplete="off">
          <OtpInput
            digits={otp.digits}
            inputRefs={otp.inputRefs}
            onChange={otp.onChange}
            onKeyDown={otp.onKeyDown}
            onPaste={otp.onPaste}
            hasError={auth.message?.type === 'error'}
          />

          <button
            className="am-btn"
            type="submit"
            disabled={!otp.isComplete || auth.loading}
          >
            {auth.loading ? 'Verifying…' : 'Verify & Continue'}
          </button>
        </form>

        {/* ── Resend ── */}
        <div className="am-resend-row">
          <span>Didn't receive a code?</span>
          <button
            className="am-resend-btn"
            type="button"
            disabled={auth.resendCooldown > 0 || auth.resendLoading}
            onClick={auth.resend}
          >
            {auth.resendLoading
              ? 'Sending…'
              : auth.resendCooldown > 0
                ? <span className="am-resend-timer">Resend in {auth.resendCooldown}s</span>
                : 'Resend code'}
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="am-footer">© 2026 HostOps. All rights reserved.</div>
      </div>
    </div>
  );
}
