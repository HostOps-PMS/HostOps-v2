import React, { useEffect, useRef, useState } from 'react';

// ─── constants ───────────────────────────────────────────────────────────────
const PLAN_FEATURES = {
  starter: [
    'Guest messaging (24/7)',
    'Dynamic pricing',
    'Channel management',
    'Cleaning coordination',
  ],
  growth: [
    'Everything in Starter',
    'Priority support',
    'Revenue reporting',
    'Multi-platform inbox',
  ],
};

const PLATFORMS = [
  'Airbnb',
  'VRBO',
  'Booking.com',
  'Facebook Page',
  'Google Business Profile',
  'WhatsApp',
];

const WEBHOOK_URL =
  'https://services.leadconnectorhq.com/hooks/tNBNUWL2UsKDlnI8KfJk/webhook-trigger/fb0aafca-c563-46f6-8201-e247c57893ca';

// ─── inline field style (replaces .hc-field class) ───────────────────────────
const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1.5px solid #d6e8df',
  background: '#fff',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '.92rem',
  color: '#0c1c14',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color .15s',
};

const fieldDisabledStyle = {
  ...fieldStyle,
  opacity: 0.65,
  cursor: 'not-allowed',
  background: '#f0f5f2',
  color: '#4a7060',
};

// ─── small helpers ────────────────────────────────────────────────────────────
function CheckIcon({ color = '#26a676', size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronLeft({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function InfoIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  const labels = ['Choose Plan', 'Your Details', 'Payment'];
  const pct = Math.round((step / 3) * 100);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        height: 4, background: '#e3ede8', borderRadius: 4,
        overflow: 'hidden', marginBottom: 6,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: '#26a676',
          borderRadius: 4, transition: 'width .4s ease',
        }} />
      </div>
      <div style={{ fontSize: '.72rem', color: '#9ab8a9', fontWeight: 600 }}>
        Step {step} of 3 — {labels[step - 1]}
      </div>
    </div>
  );
}

// ─── STEP 1: Choose Plan ──────────────────────────────────────────────────────
function StepChoosePlan({ answers, onChange, onNext }) {
  return (
    <>
      <ProgressBar step={1} />
      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: '1.5rem',
        fontWeight: 800, color: '#0c1c14', marginBottom: 6,
      }}>
        Choose Your Plan
      </div>
      <div style={{ fontSize: '.88rem', color: '#6a8b7c', marginBottom: 20 }}>
        No hidden fees. Cancel anytime after the first month.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {['starter', 'growth'].map((plan) => {
          const active = answers.plan === plan;
          const isGrowth = plan === 'growth';
          return (
            <div
              key={plan}
              onClick={() => onChange({ plan })}
              style={{
                padding: 18, borderRadius: 14, cursor: 'pointer', position: 'relative',
                border: `2px solid ${active ? '#26a676' : '#e3ede8'}`,
                background: active ? '#eaf8f1' : '#fff',
                transition: 'all .2s',
              }}
            >
              {isGrowth && (
                <div style={{
                  position: 'absolute', top: -1, right: 12,
                  background: '#26a676', color: '#fff',
                  fontSize: '.65rem', fontWeight: 800,
                  padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.5px',
                }}>
                  POPULAR
                </div>
              )}
              <div style={{
                fontSize: '.72rem', fontWeight: 700,
                color: active ? '#1e8760' : '#9ab8a9',
                letterSpacing: '.5px', marginBottom: 8, textTransform: 'uppercase',
              }}>
                {plan}
              </div>
              <div style={{
                fontFamily: "'Sora',sans-serif", fontSize: '1.6rem',
                fontWeight: 800, color: '#0c1c14',
              }}>
                {isGrowth ? '$2,500' : '$1,500'}
                <span style={{ fontSize: '.8rem', fontWeight: 500, color: '#6a8b7c' }}>/mo</span>
              </div>
              <div style={{ fontSize: '.75rem', color: '#26a676', fontWeight: 600, marginBottom: 12 }}>
                {isGrowth ? '4–7 properties' : '1–3 properties'}
              </div>
              <div style={{ fontSize: '.75rem', color: '#6a8b7c', marginBottom: 4 }}>
                + $2,000 one-time setup
              </div>
              {PLAN_FEATURES[plan].map((f) => (
                <div key={f} style={{
                  fontSize: '.78rem', color: '#2a4e3c', marginTop: 5,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckIcon /> {f}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{
        background: '#fffbe6', border: '1px solid #f5e08a', borderRadius: 10,
        padding: '12px 16px', fontSize: '.82rem', color: '#7a6a00',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <InfoIcon />
        30-day satisfaction guarantee. Not happy? We make it right.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={onNext} style={btnPrimary}>
          Continue <ChevronRight />
        </button>
      </div>
    </>
  );
}

// ─── STEP 2: Your Details ─────────────────────────────────────────────────────
function StepYourDetails({ answers, onChange, onNext, onBack }) {
  // Fields are locked if they came from the logged-in user
  const nameFixed  = !!answers.nameFromUser;
  const emailFixed = !!answers.emailFromUser;

  // FIX: validation uses the actual values, not whether they came from user
  const nameVal  = answers.name.trim();
  const emailVal = answers.email.trim();

  const isValid =
    nameVal.length > 0 &&
    emailVal.includes('@') && emailVal.includes('.') &&
    answers.props !== '' &&
    answers.platforms.length > 0;

  function togglePlatform(p) {
    const idx = answers.platforms.indexOf(p);
    const next = idx > -1
      ? answers.platforms.filter((x) => x !== p)
      : [...answers.platforms, p];
    onChange({ platforms: next });
  }

  return (
    <>
      <ProgressBar step={2} />
      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: '1.5rem',
        fontWeight: 800, color: '#0c1c14', marginBottom: 6,
      }}>
        Your Details
      </div>
      <div style={{ fontSize: '.88rem', color: '#6a8b7c', marginBottom: 20 }}>
        We'll use this to set up your account.
      </div>

      {/* Full Name */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Full Name</label>
        <input
          type="text"
          placeholder="Your full name"
          value={answers.name}
          disabled={nameFixed}
          onChange={(e) => onChange({ name: e.target.value })}
          style={nameFixed ? fieldDisabledStyle : fieldStyle}
        />
        {nameFixed && (
          <div style={{ fontSize: '.72rem', color: '#9ab8a9', marginTop: 4 }}>
            ✓ From your account
          </div>
        )}
      </div>

      {/* Email */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={answers.email}
          disabled={emailFixed}
          onChange={(e) => onChange({ email: e.target.value })}
          style={emailFixed ? fieldDisabledStyle : fieldStyle}
        />
        {emailFixed && (
          <div style={{ fontSize: '.72rem', color: '#9ab8a9', marginTop: 4 }}>
            ✓ From your account
          </div>
        )}
      </div>

      {/* Number of Properties */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Number of Properties</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {['1–3 properties', '4–7 properties'].map((o) => {
            const active = answers.props === o;
            return (
              <button
                key={o}
                onClick={() => onChange({ props: o })}
                style={{
                  padding: 13, borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${active ? '#26a676' : '#e3ede8'}`,
                  background: active ? '#eaf8f1' : '#fff',
                  fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem',
                  fontWeight: 600, color: active ? '#1e8760' : '#2a4e3c',
                  transition: 'all .2s',
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>

      {/* Platforms */}
      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>Platforms Currently Used</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PLATFORMS.map((p) => {
            const on = answers.platforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                  border: `1.5px solid ${on ? '#26a676' : '#e3ede8'}`,
                  background: on ? '#eaf8f1' : '#fff',
                  fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem',
                  fontWeight: 600, color: '#2a4e3c', transition: 'all .2s',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `1.5px solid ${on ? '#26a676' : '#d1e8dd'}`,
                  background: on ? '#26a676' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckIcon color={on ? '#fff' : 'transparent'} size={10} />
                </span>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 24,
      }}>
        <button onClick={onBack} style={btnBack}>
          <ChevronLeft /> Back
        </button>
        <button
          onClick={() => isValid && onNext()}
          style={{
            ...btnPrimary,
            opacity: isValid ? 1 : 0.4,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}
        >
          Continue <ChevronRight />
        </button>
      </div>
    </>
  );
}

// ─── STEP 3: Payment ──────────────────────────────────────────────────────────
function StepPayment({ answers, onBack }) {
  const [payTab, setPayTab]       = useState('gcash');
  const [gcashQR, setGcashQR]     = useState(null);
  const [saligPayQR, setSaligPayQR] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | loading | done | error

  const isStarter = answers.plan === 'starter';
  const planLabel = isStarter ? 'Starter — $1,500/mo' : 'Growth — $2,500/mo';

  function handleQRUpload(e, setter) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setter(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handlePaymentSent() {
    if (submitState !== 'idle') return;
    setSubmitState('loading');
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name:      answers.name ? answers.name.split(' ')[0] : '',
          last_name:       answers.name ? answers.name.split(' ').slice(1).join(' ') : '',
          email:           answers.email || '',
          plan:            isStarter ? 'Starter - $1,500/mo' : 'Growth - $2,500/mo',
          properties:      answers.props || '',
          platforms:       answers.platforms ? answers.platforms.join(', ') : '',
          payment_status:  'Pending - Awaiting GCash Confirmation',
          setup_fee:       '$2,000.00',
          source:          'HostPilot Website',
        }),
      });
      setSubmitState('done');
    } catch (err) {
      console.error('Webhook Error:', err);
      setSubmitState('error');
    }
  }

  return (
    <>
      <ProgressBar step={3} />
      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: '1.5rem',
        fontWeight: 800, color: '#0c1c14', marginBottom: 6,
      }}>
        Payment
      </div>
      <div style={{ fontSize: '.88rem', color: '#6a8b7c', marginBottom: 20 }}>
        Setup fee billed today. Monthly plan begins after activation.
      </div>

      {/* Order Summary */}
      <div style={{
        border: '1px solid #e3ede8', borderRadius: 14,
        padding: '18px 20px', marginBottom: 16,
      }}>
        <div style={{
          fontSize: '.7rem', fontWeight: 700, color: '#9ab8a9',
          letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 12,
        }}>
          ORDER SUMMARY
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '.88rem', color: '#2a4e3c', marginBottom: 8,
        }}>
          <span>One-time setup fee</span>
          <span style={{ fontWeight: 700 }}>$2,000.00</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: '.82rem',
          color: '#2a4e3c', marginBottom: 12,
          padding: '8px 12px', background: '#f0f5f2', borderRadius: 8,
        }}>
          <span>{planLabel}</span>
          <span style={{ color: '#9ab8a9', fontWeight: 600 }}>Billed after activation</span>
        </div>
        <div style={{
          borderTop: '1px solid #e3ede8', paddingTop: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '.9rem', fontWeight: 700, color: '#0c1c14' }}>Due today</span>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontSize: '1.2rem',
            fontWeight: 800, color: '#0c1c14',
          }}>$2,000.00</span>
        </div>
      </div>

      {/* Payment Method Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'gcash',    label: '💙 GCash'    },
          { id: 'saligpay', label: '🟠 SaligPay' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setPayTab(id)}
            style={{
              flex: 1, padding: 10, borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', fontWeight: 700,
              background: payTab === id ? '#1555C0' : '#e8f0ff',
              color: payTab === id ? '#fff' : '#1555C0',
              transition: 'all .2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* GCash Details */}
      {payTab === 'gcash' && (
        <PaymentDetails
          accentColor="#1555C0"
          bgColor="#f0f7ff"
          borderColor="#c8dff8"
          btnBg="#e8f0ff"
          btnColor="#1555C0"
          dividerColor="#ddeaf8"
          uploadBg="#26a676"
          label="💙 GCash Payment Details"
          numberLabel="GCash Number"
          qrPreview={gcashQR}
          uploadLabel="Upload GCash QR"
          onQRUpload={(e) => handleQRUpload(e, setGcashQR)}
        />
      )}

      {/* SaligPay Details */}
      {payTab === 'saligpay' && (
        <PaymentDetails
          accentColor="#c05c00"
          bgColor="#fff8f0"
          borderColor="#ffd8a8"
          btnBg="#ffe8cc"
          btnColor="#c05c00"
          dividerColor="#ffd8a8"
          uploadBg="#e87c00"
          label="🟠 SaligPay Payment Details"
          numberLabel="SaligPay Number"
          qrPreview={saligPayQR}
          uploadLabel="Upload SaligPay QR"
          onQRUpload={(e) => handleQRUpload(e, setSaligPayQR)}
        />
      )}

      {/* Info */}
      <div style={{
        background: '#fffbe6', border: '1px solid #f5e08a', borderRadius: 10,
        padding: '12px 16px', fontSize: '.82rem', color: '#7a6a00',
        display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4,
      }}>
        <InfoIcon />
        <span>
          ACH transfers are <strong>free</strong> (1–3 business days). Wire transfers cost $15 but arrive same day.
          After sending, <strong>email us your receipt</strong> and we'll activate your account within 24 hours.
        </span>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 24,
      }}>
        <button
          onClick={onBack}
          disabled={submitState === 'done'}
          style={btnBack}
        >
          <ChevronLeft /> Back
        </button>

        {submitState === 'done' ? (
          <button style={{ ...btnPrimary, background: '#1e8760', cursor: 'default' }}>
            ✅ Received! We'll confirm within 24 hours.
          </button>
        ) : submitState === 'error' ? (
          <button onClick={() => setSubmitState('idle')} style={{ ...btnPrimary, background: '#e55353' }}>
            ⚠ Retry
          </button>
        ) : (
          <button
            onClick={handlePaymentSent}
            disabled={submitState === 'loading'}
            style={{ ...btnPrimary, opacity: submitState === 'loading' ? 0.75 : 1 }}
          >
            {submitState === 'loading' ? '⏳ Sending...' : "I've Sent My Payment ✓"}
          </button>
        )}
      </div>
    </>
  );
}

// ─── Reusable payment details block ──────────────────────────────────────────
function PaymentDetails({
  accentColor, bgColor, borderColor, btnBg, btnColor,
  dividerColor, uploadBg, label, numberLabel,
  qrPreview, uploadLabel, onQRUpload,
}) {
  function copy(text, e) {
    navigator.clipboard.writeText(text);
    const btn = e.currentTarget;
    const prev = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1500);
  }

  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 14, padding: '18px 20px', marginBottom: 16,
    }}>
      <div style={{
        fontSize: '.7rem', fontWeight: 700, color: accentColor,
        letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 14,
      }}>
        {label}
      </div>

      {[
        { fieldLabel: 'Account Name', value: 'JENALYN VALLER' },
        { fieldLabel: numberLabel, value: '0917 123 4567', copyVal: '09171234567' },
      ].map(({ fieldLabel, value, copyVal }) => (
        <div key={fieldLabel} style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: '.7rem', color: '#6a8b7c', fontWeight: 600, marginBottom: 2 }}>
              {fieldLabel}
            </div>
            <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#0c1c14' }}>{value}</div>
          </div>
          <button
            onClick={(e) => copy(copyVal || value, e)}
            style={{
              background: btnBg, border: 'none', borderRadius: 8,
              padding: '6px 10px', fontSize: '.72rem', fontWeight: 700,
              color: btnColor, cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${dividerColor}`, paddingTop: 14 }}>
        <div style={{
          fontSize: '.7rem', color: '#6a8b7c', fontWeight: 600,
          marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px',
        }}>
          Or scan QR Code
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {qrPreview && (
            <img
              src={qrPreview}
              alt="QR Code"
              style={{
                width: 140, height: 140, borderRadius: 12,
                border: `2px solid ${borderColor}`, objectFit: 'contain',
              }}
            />
          )}
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', background: uploadBg, color: '#fff',
            borderRadius: 100, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer',
          }}>
            📤 {uploadLabel}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onQRUpload} />
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── shared styles ────────────────────────────────────────────────────────────
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '13px 28px', background: '#26a676', color: '#fff',
  fontFamily: "'DM Sans',sans-serif", fontSize: '.95rem', fontWeight: 700,
  border: 'none', borderRadius: 100, cursor: 'pointer',
  boxShadow: '0 6px 20px rgba(38,166,118,.35)',
  transition: 'opacity .2s',
};

const btnBack = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none',
  fontFamily: "'DM Sans',sans-serif", fontSize: '.88rem',
  color: '#9ab8a9', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', fontSize: '.82rem', fontWeight: 700,
  color: '#0c1c14', marginBottom: 6,
};

// ─── helper: normalise property range from quiz answers ───────────────────────
function normalisePropRange(raw) {
  if (!raw) return '';
  if (raw === 'Just 1' || raw === '2 – 3' || raw === '1–3 properties') return '1–3 properties';
  if (raw === '4 – 6' || raw === '7 or more' || raw === '4–7 properties') return '4–7 properties';
  return '';
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
/**
 * PricingModal — 3-step checkout modal
 *
 * Props:
 *   isOpen   {boolean}   — controls visibility
 *   onClose  {function}  — called when the modal should close
 *   user     {object}    — logged-in user: { firstName, lastName, email }
 *                          Pass this from your auth context / useAuth() hook.
 *                          When provided, Full Name & Email are pre-filled and locked.
 */
export default function PricingModal({ isOpen, onClose, user = null }) {
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState(null);
  const cardRef               = useRef(null);

  // Build the full name from user object
  const userFullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    : '';

  // Initialise / reset answers whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setAnswers({
        plan:          'starter',
        // Store actual values for the fields
        name:          userFullName,
        email:         user?.email || '',
        props:         normalisePropRange('') || '',
        platforms:     [],
        // Track whether these came from logged-in user (to lock inputs)
        nameFromUser:  !!userFullName,
        emailFromUser: !!(user?.email),
      });
    }
  }, [isOpen, userFullName, user]); // re-init if user changes too

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function merge(partial) {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }

  if (!isOpen || !answers) return null;

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(4,14,9,.6)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: '100%', maxWidth: 520, background: '#f8fbf9',
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(4,14,9,.25)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0' }}>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none',
              background: '#e8f0ec', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: '#6a8b7c',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 28px 28px' }}>
          {step === 0 && (
            <StepChoosePlan
              answers={answers}
              onChange={merge}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <StepYourDetails
              answers={answers}
              onChange={merge}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepPayment
              answers={answers}
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}