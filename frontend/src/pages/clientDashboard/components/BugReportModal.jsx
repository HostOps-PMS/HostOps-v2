import { useState, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { getSecureUser } from '../../../lib/secureUserStorage';
import { useDashboard } from '../context/DashboardContext';
import safeStorage from '../../safeStorage';
import RichTextInput from './RichTextInput';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.hostops.online').replace(/\/$/, '');
const API_KEY  = import.meta.env.VITE_API_KEY || '';

function getUser() {
  try { return getSecureUser(); } catch { return null; }
}

const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: '#22c55e' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { value: 'high',     label: 'High',     color: '#f97316' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
];

function sevColor(v) { return SEVERITY_OPTIONS.find(s => s.value === v)?.color || '#f97316'; }
function sevLabel(v) { return SEVERITY_OPTIONS.find(s => s.value === v)?.label || 'High'; }

function fmtNow() {
  return new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function BugReportModal({ show, onClose }) {
  const { dark } = useDashboard();
  const user = getUser();
  const [description, setDescription] = useState('');
  const [page, setPage]               = useState('');
  const [severity, setSeverity]       = useState('high');
  const [images, setImages]            = useState([]); // File[]
  const [previews, setPreviews]        = useState([]); // data URL strings
  const fileRef                        = useRef(null);
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState('form'); // form | preview | submitted
  const [error, setError]             = useState('');

  if (!show) return null;

  const minLength = 10;
  const plainText = description.replace(/<[^>]*>/g, '').trim();
  const canPreview = plainText.length >= minLength && page.trim().length > 0;

  const bg      = dark ? '#132a1e' : '#ffffff';
  const border  = dark ? '#1e3a2a' : '#e3ede8';
  const text    = dark ? '#eaf5f0' : '#0c1c14';
  const muted   = dark ? '#7ab89a' : '#6b7280';
  const inputBg = dark ? '#0d2619' : '#f8fbf9';
  const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || 'Unknown');

  function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 5 - images.length);
    if (!files.length) return;
    setImages(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => setPreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('email', user?.email || '');
      fd.append('name', userName);
      fd.append('page', page.trim());
      fd.append('severity', severity);
      fd.append('description', description.trim());
      images.forEach(f => fd.append('images', f));

      const res = await fetch(`${API_BASE}/auth/bug-report`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }
      setStep('submitted');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setDescription('');
    setPage('');
    setSeverity('high');
    setImages([]);
    setPreviews([]);
    setStep('form');
    setError('');
    onClose();
  }

  const sc = sevColor(severity);

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(2px)',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: bg, borderRadius: 20, padding: '28px 24px 24px',
          width: '100%', maxWidth: step === 'preview' ? 500 : 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative', animation: 'bugmodal-in 0.22s ease',
          border: `1px solid ${border}`, maxHeight: '90vh', overflowY: 'auto',
          transition: 'max-width 0.2s ease',
        }}>
          {/* Close */}
          <button onClick={handleClose} style={{
            position: 'absolute', top: 14, right: 14, background: 'none',
            border: 'none', cursor: 'pointer', color: muted, fontSize: 18, padding: 4, lineHeight: 1, zIndex: 1,
          }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* ── SUBMITTED ── */}
          {step === 'submitted' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: dark ? '#0d2619' : '#eaf8f1', border: '1.5px solid #26a676',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#26a676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: '0 0 10px' }}>Report Submitted</h2>
              <p style={{ color: muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Your bug report has been sent to our team. We'll review it and take action as soon as possible.
              </p>
              <button onClick={handleClose} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #26a676, #1e8760)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Close</button>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === 'preview' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>Preview Bug Report</h2>
              </div>

              {/* Formal report card */}
              <div style={{
                border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16,
              }}>
                {/* Header bar */}
                <div style={{
                  background: dark ? '#0c1c14' : '#f8faf9', padding: '12px 16px',
                  borderBottom: `1px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: text }}>
                    [BUG REPORT] [{sevLabel(severity).toUpperCase()}] [HostOps]
                  </span>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                    fontSize: 11, fontWeight: 700, color: '#fff', background: sc,
                  }}>{sevLabel(severity)}</span>
                </div>

                {/* Body */}
                <div style={{ padding: '16px' }}>
                  {/* Date/Time */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Date/Time Discovered</div>
                    <div style={{ fontSize: 13, color: text }}>{fmtNow()}</div>
                  </div>

                  {/* Reported By */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Reported By</div>
                    <div style={{ fontSize: 13, color: text }}>{userName}</div>
                    <div style={{ fontSize: 12, color: muted }}>{user?.email || ''}</div>
                  </div>

                  {/* Page/Module */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Page/Module Affected</div>
                    <div style={{ fontSize: 13, color: text }}>{page}</div>
                  </div>

                  {/* Divider */}
                  <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '14px 0' }} />

                  {/* Description */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Bug Description</div>
                    <div style={{ fontSize: 13, color: text, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: description }} />
                  </div>

                  {/* Attached screenshots */}
                  {previews.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Attachments ({previews.length})</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {previews.map((src, i) => (
                          <img key={i} src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${border}` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                  background: dark ? '#2a0d0d' : '#fef2f2', border: `1px solid ${dark ? '#5c1a1a' : '#fecaca'}`,
                  color: dark ? '#f87171' : '#dc2626', fontSize: 13,
                }}>{error}</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('form'); setError(''); }} disabled={loading} style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10,
                  border: `1px solid ${border}`, background: 'transparent',
                  color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>← Edit</button>
                <button onClick={handleSubmit} disabled={loading} style={{
                  flex: 2, padding: '11px 16px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #26a676, #1e8760)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(38,166,118,0.3)',
                }}>{loading ? 'Submitting…' : 'Submit Bug Report'}</button>
              </div>
            </>
          )}

          {/* ── FORM ── */}
          {step === 'form' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>🐛</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Report a Bug</h2>
              </div>
              <p style={{ color: muted, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                Found something broken? Let us know and we'll fix it right away.
              </p>

              {/* Email (read-only) */}
              {user?.email && (
                <div style={{
                  background: inputBg, border: `1.5px solid ${border}`, borderRadius: 10,
                  padding: '10px 14px', marginBottom: 14, fontSize: 13, color: text,
                }}>
                  <span style={{ color: muted, fontSize: 11, display: 'block', marginBottom: 2 }}>Your email</span>
                  <strong>{user.email}</strong>
                </div>
              )}

              {/* Page / Module */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 5 }}>
                  Page or feature affected <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={page}
                  onChange={e => setPage(e.target.value)}
                  placeholder="e.g. Dashboard → Bookings → Booking Details Page"
                  maxLength={200}
                  disabled={loading}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10,
                    border: `1.5px solid ${border}`, fontSize: 14, color: text,
                    background: inputBg, outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#26a676'; }}
                  onBlur={e => { e.target.style.borderColor = border; }}
                />
              </div>

              {/* Severity */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>
                  Severity
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SEVERITY_OPTIONS.map(s => {
                    const active = severity === s.value;
                    return (
                      <button key={s.value} onClick={() => setSeverity(s.value)} disabled={loading} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                        border: `1.5px solid ${active ? s.color : border}`,
                        background: active ? (dark ? 'rgba(255,255,255,0.05)' : `${s.color}10`) : 'transparent',
                        color: active ? s.color : muted,
                        fontWeight: active ? 600 : 400, fontSize: 12, fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 5 }}>
                  Bug description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <RichTextInput
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the bug: what you did, what you expected, what actually happened…"
                  dark={dark}
                  disabled={loading}
                  minLength={minLength}
                  maxLength={2000}
                />
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>
                  Screenshots (optional, max 5)
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {previews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${border}` }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeImage(i)} style={{
                        position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}>✕</button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button onClick={() => fileRef.current?.click()} disabled={loading} style={{
                      width: 64, height: 64, borderRadius: 8, border: `1.5px dashed ${border}`,
                      background: inputBg, cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 2, color: muted, fontSize: 10, fontFamily: 'inherit',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload
                    </button>
                  )}
                </div>
              </div>

              <button onClick={() => setStep('preview')} disabled={!canPreview} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                background: canPreview ? 'linear-gradient(135deg, #26a676, #1e8760)' : (dark ? '#1e3a2a' : '#e5e7eb'),
                color: canPreview ? '#fff' : (dark ? '#4d8a6a' : '#9ca3af'),
                fontSize: 14, fontWeight: 600, cursor: canPreview ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', marginBottom: 8, transition: 'all 0.15s',
                boxShadow: canPreview ? '0 2px 8px rgba(38,166,118,0.3)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                Preview Report
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>

              <button onClick={handleClose} disabled={loading} style={{
                width: '100%', padding: '10px 20px', borderRadius: 12, border: 'none',
                background: 'transparent', color: muted, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bugmodal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}
