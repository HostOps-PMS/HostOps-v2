import { useState, useEffect } from 'react';
import OtpInput from './OtpInput';
import { useOtp }           from '../hooks/useOtp';
import { useAuthorization } from '../hooks/useAuthorization';
import LockoutTimer         from './LockoutTimer';

import pro1 from '../../../assets/pro1.jpg';
import pro2 from '../../../assets/pro2.jpg';
import pro3 from '../../../assets/pro3.jpg';
import pro4 from '../../../assets/pro4.jpg';
import pro5 from '../../../assets/pro5.jpg';
import hostOpsLogo from '../../../assets/HostOpsLOGO.png';

const SLIDES = [pro1, pro2, pro3, pro4, pro5];

export default function AuthModal({ onAuthorized }) {
  const otp = useOtp();
  const auth = useAuthorization(onAuthorized);
  const maskedEmail = auth.userEmail
    ? auth.userEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : '';
  const [currentSlide, setCurrentSlide] = useState(0);
const [method, setMethod] = useState(auth.totpEnabled ? 'choose' : 'email');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!otp.isComplete || auth.loading) return;
    const success = await auth.submit(otp.otp);
    if (!success) otp.reset();
  }

  return (
    <div className="am-overlay" role="dialog" aria-modal="true" aria-labelledby="am-title">

      <div className="am-slideshow">
        {SLIDES.map((src, i) => (
          <div
            key={i}
            className={`am-slide${i === currentSlide ? ' am-slide--active' : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="am-slide-overlay" />
        <div className="am-slide-content">
          <div className="am-slide-logo">
            <img src={hostOpsLogo} alt="HostOps" className="am-slide-logo-img" />
            <span className="am-slide-brand">HostOps</span>
          </div>
          <div>
            <div className="am-slide-tagline">
              Your<br />properties,<br /><em>always</em><br />in view.
            </div>
            <p className="am-slide-sub">Real-time insights for every property you manage.</p>
          </div>
        </div>
      </div>

      <div className="am-form-panel">
        <div className="am-badge-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0faf5', border: '0.5px solid #c8e6d8', borderRadius: '20px', padding: '4px 10px 4px 6px' }}>
            <div className="am-icon-wrap am-icon-wrap--glow" aria-hidden="true" style={{ width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'transparent', margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="#1e8760" strokeWidth="2" strokeLinecap="round"
                   strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <span style={{ fontSize: '12px', color: '#1e8760', fontWeight: 600 }}>Admin panel</span>
          </div>
        </div>

        {/* ── CHOOSE METHOD SCREEN ── */}
        {method === 'choose' && (
          <>
            <h1 className="am-title" id="am-title">Two-step verification</h1>
            <p className="am-sub">Choose how you want to verify your identity.</p>

            {auth.message && (
              <div className={`am-msg am-msg--${auth.message.type}`}>{auth.message.text}</div>
            )}

            <button className="am-method-card" onClick={() => setMethod('totp')}>
              <div className="am-method-icon am-method-icon--app">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
                </svg>
              </div>
              <div className="am-method-text">
                <span className="am-method-title">Authenticator app</span>
                <span className="am-method-desc">Use a 6-digit code from your app</span>
              </div>
              <svg className="am-method-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <button className="am-method-card" onClick={() => { setMethod('email'); auth.sendOtp(); }}>
              <div className="am-method-icon am-method-icon--email">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div className="am-method-text">
                <span className="am-method-title">Email OTP</span>
                <span className="am-method-desc">Send a code to your email</span>
              </div>
              <svg className="am-method-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <button type="button" className="am-back-btn" onClick={() => window.history.back()}>← Back to login</button>
            <div className="am-footer">© {new Date().getFullYear()} HostOps. All rights reserved.</div>
          </>
        )}

        {/* ── TOTP SCREEN ── */}
        {method === 'totp' && (
          <>
            <h1 className="am-title" id="am-title">Authenticator code</h1>
            <p className="am-sub">Enter the <strong>6-digit code</strong> from your authenticator app.</p>

            {auth.message && (
              <div className={`am-msg am-msg--${auth.message.type}`}>{auth.message.text}</div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!otp.isComplete || auth.loading) return;
              const success = await auth.submitTotp(otp.otp);
              if (!success) otp.reset();
            }} autoComplete="off">
              {auth.lockoutTimer <= 0 && (
                <OtpInput
                  digits={otp.digits}
                  inputRefs={otp.inputRefs}
                  onChange={otp.onChange}
                  onKeyDown={otp.onKeyDown}
                  onPaste={otp.onPaste}
                  hasError={auth.message?.type === 'error'}
                  disabled={auth.lockoutTimer > 0}
                />
              )}
              <LockoutTimer lockoutTimer={auth.lockoutTimer} />
              <button
                className="am-btn am-btn--modern"
                type="submit"
                disabled={!otp.isComplete || auth.loading || auth.lockoutTimer > 0}
              >
                {auth.loading ? <><span className="am-btn-spinner" />Verifying…</> : 'Continue →'}
              </button>
            </form>

            <button type="button" className="am-back-btn" onClick={() => { setMethod('choose'); otp.reset(); }}>
              ← Use a different method
            </button>
            <div className="am-footer">© {new Date().getFullYear()} HostOps. All rights reserved.</div>
          </>
        )}

        {/* ── EMAIL OTP SCREEN ── */}
        {method === 'email' && (
          <>
            <h1 className="am-title" id="am-title">Two-step verification</h1>
            <p className="am-sub">
              Enter the <strong>6-digit code</strong> sent to{' '}
              {maskedEmail ? <strong>{maskedEmail}</strong> : 'your registered email'}.
            </p>

            {auth.message && (
              <div className={`am-msg am-msg--${auth.message.type}`}>{auth.message.text}</div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off">
              {auth.lockoutTimer <= 0 && (
                <OtpInput
                  digits={otp.digits}
                  inputRefs={otp.inputRefs}
                  onChange={otp.onChange}
                  onKeyDown={otp.onKeyDown}
                  onPaste={otp.onPaste}
                  hasError={auth.message?.type === 'error'}
                  disabled={auth.lockoutTimer > 0}
                />
              )}
              <LockoutTimer lockoutTimer={auth.lockoutTimer} initialTimer={90} />
              <button
                className="am-btn am-btn--modern"
                type="submit"
                disabled={!otp.isComplete || auth.loading || auth.lockoutTimer > 0}
              >
                {auth.loading ? <><span className="am-btn-spinner" />Verifying…</> : 'Continue →'}
              </button>
            </form>

            <div className="am-resend-row" style={{ justifyContent: 'center' }}>
              {auth.resendCooldown > 0
                ? <span className="am-resend-timer am-resend-timer--block">Code expires in {auth.resendCooldown}s</span>
                : <>
                    <span>Didn't receive it?</span>
                    <button
                      className="am-resend-btn"
                      type="button"
                      disabled={auth.resendLoading}
                      onClick={auth.resend}
                    >
                      {auth.resendLoading ? 'Sending…' : 'Resend code'}
                    </button>
                  </>}
            </div>

            {auth.totpEnabled
              ? <button type="button" className="am-back-btn" onClick={() => { setMethod('choose'); otp.reset(); }}>← Use a different method</button>
              : <button type="button" className="am-back-btn" onClick={() => window.history.back()}>← Back to login</button>
            }
            <div className="am-footer">© {new Date().getFullYear()} HostOps. All rights reserved.</div>
          </>
        )}
      </div>

    </div>
  );
}