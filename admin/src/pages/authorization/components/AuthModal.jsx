import { useState, useEffect } from 'react';
import OtpInput from './OtpInput';
import { useOtp }           from '../hooks/useOtp';
import { useAuthorization } from '../hooks/useAuthorization';

const SLIDES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

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
            <img
              src="/src/assets/HostOpsLOGO.png"
              alt="HostOps"
              className="am-slide-logo-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
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

            <button
              className="am-btn am-btn--modern"
              style={{ marginBottom: 12, background: '#1e8760' }}
              onClick={() => setMethod('totp')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
              </svg>
              Use Authenticator App
            </button>

            <button
              className="am-btn am-btn--modern"
              onClick={() => { setMethod('email'); auth.resend(); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Use Email OTP
            </button>

            <div className="am-footer">© 2026 HostOps. All rights reserved.</div>
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
              <OtpInput
                digits={otp.digits}
                inputRefs={otp.inputRefs}
                onChange={otp.onChange}
                onKeyDown={otp.onKeyDown}
                onPaste={otp.onPaste}
                hasError={auth.message?.type === 'error'}
              />
              <button
                className="am-btn am-btn--modern"
                type="submit"
                disabled={!otp.isComplete || auth.loading}
              >
                {auth.loading ? <><span className="am-btn-spinner" />Verifying…</> : 'Continue →'}
              </button>
            </form>

            <button type="button" className="am-back-btn" onClick={() => { setMethod('choose'); otp.reset(); }}>
              ← Use a different method
            </button>
            <div className="am-footer">© 2026 HostOps. All rights reserved.</div>
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
              <OtpInput
                digits={otp.digits}
                inputRefs={otp.inputRefs}
                onChange={otp.onChange}
                onKeyDown={otp.onKeyDown}
                onPaste={otp.onPaste}
                hasError={auth.message?.type === 'error'}
              />
              <button
                className="am-btn am-btn--modern"
                type="submit"
                disabled={!otp.isComplete || auth.loading}
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
            <div className="am-footer">© 2026 HostOps. All rights reserved.</div>
          </>
        )}
      </div>

    </div>
  );
}