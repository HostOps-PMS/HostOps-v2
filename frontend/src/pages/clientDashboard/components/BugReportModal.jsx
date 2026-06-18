import { useState, useRef, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../AuthContext';
import RichTextInput from './RichTextInput';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.hostops.online').replace(/\/$/, '');
const API_KEY  = import.meta.env.VITE_API_KEY || '';

function getUserData(auth) {
  let u = auth?.getUser?.();
  if (u && u.user && !u.email && typeof u.user === 'object') u = u.user;
  if (u && (u.businessName || u.firstName || u.email)) return u;
  try { return JSON.parse(sessionStorage.getItem('hp_user') || 'null'); } catch { return null; }
}

const SEV = [
  { value: 'low',      label: 'Low',      color: '#22c55e', desc: 'Minor visual issue' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b', desc: 'Feature works incorrectly' },
  { value: 'high',     label: 'High',     color: '#f97316', desc: 'Major feature broken' },
  { value: 'critical', label: 'Critical', color: '#ef4444', desc: 'System down or data loss' },
];

function fmtDate() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BugReportModal({ show, onClose }) {
  const { dark } = useDashboard();
  const auth = useAuth();
  const user = getUserData(auth);
  const [description, setDescription] = useState('');
  const [page, setPage]       = useState('');
  const [severity, setSeverity] = useState('high');
  const [images, setImages]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileRef               = useRef(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState('form');
  const [error, setError]     = useState('');
  const dropRef               = useRef(null);

  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.businessName || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userInitial = (userName[0] || 'U').toUpperCase();
  const sc = SEV.find(s => s.value === severity) || SEV[2];

  // HostOps theme
  const brand   = '#1a9e6e';
  const brandDk = '#157a55';
  const surface = dark ? '#0f1f17' : '#ffffff';
  const card    = dark ? '#152a1f' : '#f6f9f7';
  const border  = dark ? '#1c3528' : '#dce8e1';
  const text    = dark ? '#e4f0ea' : '#0c1c14';
  const muted   = dark ? '#5d9a7d' : '#6e8a7c';
  const inputBg = dark ? '#0b1a12' : '#f0f5f2';

  const minLen = 10;
  const plain = description.replace(/<[^>]*>/g, '').trim();
  const canPreview = plain.length >= minLen && page.trim().length > 0;

  function addFiles(files) {
    const allowed = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length);
    if (!allowed.length) return;
    setImages(prev => [...prev, ...allowed]);
    allowed.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => setPreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(f);
    });
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  // Paste screenshot support
  useEffect(() => {
    if (!show) return;
    function onPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); addFiles(files); }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [show, images.length]);

  if (!show) return null;

  async function handleSubmit() {
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('email', userEmail);
      fd.append('name', userName);
      fd.append('page', page.trim());
      fd.append('severity', severity);
      fd.append('description', description.trim());
      images.forEach(f => fd.append('images', f));
      const res = await fetch(`${API_BASE}/auth/bug-report`, { method: 'POST', headers: { 'x-api-key': API_KEY }, body: fd });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      setStep('submitted');
    } catch (err) { setError(err.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  }

  function handleClose() { setDescription(''); setPage(''); setSeverity('high'); setImages([]); setPreviews([]); setStep('form'); setError(''); onClose(); }

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(8,20,14,0.4)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: surface, borderRadius: 16, width: '100%',
          maxWidth: step === 'preview' ? 500 : 440,
          border: `1px solid ${border}`,
          boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.12)',
          animation: 'brm-in 0.22s cubic-bezier(0.16,1,0.3,1)',
          maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden',
          transition: 'max-width 0.2s ease',
        }}>

          {/* ── Header bar ── */}
          <div style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${border}`,
            background: dark ? '#0b1a12' : '#f6f9f7',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: brand,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, lineHeight: 1.2 }}>
                  {step === 'submitted' ? 'Report Sent' : step === 'preview' ? 'Review Report' : 'Report an Issue'}
                </div>
                <div style={{ fontSize: 11, color: muted }}>{fmtDate()}</div>
              </div>
            </div>
            <button onClick={handleClose} style={{
              width: 28, height: 28, borderRadius: 8, border: `1px solid ${border}`,
              background: surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: muted, transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = card; }}
              onMouseLeave={e => { e.currentTarget.style.background = surface; }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
          </div>

          <div style={{ padding: '20px 20px 16px' }}>

            {/* ═══ SUBMITTED ═══ */}
            {step === 'submitted' && (
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
                  background: `linear-gradient(135deg, ${brand}, ${brandDk})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 6px 20px ${brand}40`,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: text, margin: '0 0 6px' }}>Report Submitted</h3>
                <p style={{ color: muted, fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
                  Our team will review and take action shortly. You can track the status in your notifications.
                </p>
                <button onClick={handleClose} style={{
                  padding: '10px 28px', borderRadius: 10, border: 'none',
                  background: brand, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Close</button>
              </div>
            )}

            {/* ═══ PREVIEW ═══ */}
            {step === 'preview' && (
              <>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${border}`, background: card }}>
                  {/* Ribbon */}
                  <div style={{ padding: '12px 16px', background: '#0c1c14', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ color: '#26a676', fontSize: 12, fontWeight: 700 }}>Issue Report</span>
                    </div>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff', background: sc.color }}>{sc.label}</span>
                  </div>

                  <div style={{ padding: 16 }}>
                    {/* Reporter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: inputBg, border: `1px solid ${border}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{userInitial}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: text }}>{userName}</div>
                        <div style={{ fontSize: 11, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
                      </div>
                    </div>

                    {[['Page / Module', page], ['Severity', sc.label]].map(([l, v]) => (
                      <div key={l} style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{l}</span>
                        <div style={{ fontSize: 13, color: text, fontWeight: 500, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}

                    <div style={{ height: 1, background: border, margin: '10px 0 12px' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Description</span>
                    <div style={{ fontSize: 13, color: text, lineHeight: 1.7, marginTop: 6 }} dangerouslySetInnerHTML={{ __html: description }} />

                    {previews.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Attachments</span>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {previews.map((src, i) => (
                            <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${border}` }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: 8, marginTop: 12, background: dark ? '#2a0d0d' : '#fef2f2', color: '#ef4444', fontSize: 12, border: `1px solid ${dark ? '#5c1a1a' : '#fecaca'}` }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={() => { setStep('form'); setError(''); }} disabled={loading} style={{
                    flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${border}`,
                    background: 'transparent', color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>← Edit</button>
                  <button onClick={handleSubmit} disabled={loading} style={{
                    flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                    background: brand, color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: loading ? 0.7 : 1,
                  }}>{loading ? 'Submitting…' : 'Submit Report'}</button>
                </div>
              </>
            )}

            {/* ═══ FORM ═══ */}
            {step === 'form' && (
              <>
                {/* Reporter card (auto-detected) */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: card, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: `linear-gradient(135deg, ${brand}, ${brandDk})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>{userInitial}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{userName}</div>
                    <div style={{ fontSize: 11, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
                  </div>
                  <span style={{ fontSize: 10, color: brand, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: dark ? '#0d2619' : '#eaf8f1', border: `1px solid ${dark ? '#1c3528' : '#c8e6d8'}`, flexShrink: 0 }}>Reporter</span>
                </div>

                {/* Page */}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text, marginBottom: 5 }}>
                  Page or feature <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={page} onChange={e => setPage(e.target.value)}
                  placeholder="e.g. Dashboard → Calendar → Booking Details"
                  maxLength={200} disabled={loading}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${border}`, fontSize: 13, color: text,
                    background: inputBg, outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s', marginBottom: 14,
                  }}
                  onFocus={e => { e.target.style.borderColor = brand; }}
                  onBlur={e => { e.target.style.borderColor = border; }}
                />

                {/* Severity */}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>Severity</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {SEV.map(s => {
                    const on = severity === s.value;
                    return (
                      <button key={s.value} onClick={() => setSeverity(s.value)} disabled={loading}
                        title={s.desc}
                        style={{
                          flex: 1, padding: '7px 4px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                          border: on ? `2px solid ${s.color}` : `1.5px solid ${border}`,
                          background: on ? (dark ? `${s.color}18` : `${s.color}0c`) : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          transition: 'all 0.12s', fontFamily: 'inherit',
                        }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? s.color : muted }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Description */}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text, marginBottom: 5 }}>
                  Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <RichTextInput
                  value={description} onChange={setDescription}
                  placeholder="What happened? What did you expect instead?"
                  dark={dark} disabled={loading} minLength={minLen} maxLength={2000}
                />

                {/* Screenshots */}
                <div style={{ marginTop: 14, marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>
                    Screenshots <span style={{ color: muted, fontWeight: 400, fontSize: 11 }}>(optional, max 5)</span>
                  </label>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />

                  {/* Image previews */}
                  {previews.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {previews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${border}`, background: '#000' }}>
                          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                          <button onClick={() => removeImage(i)} style={{
                            position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 6,
                            background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 10,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons — separate paste hint from upload */}
                  {images.length < 5 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => fileRef.current?.click()} style={{
                        flex: 1, padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`,
                        background: card, cursor: 'pointer', color: muted,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 11, fontWeight: 500, fontFamily: 'inherit', transition: 'border-color 0.12s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = brand; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = border; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Upload file
                      </button>
                      <div style={{
                        flex: 1, padding: '9px 12px', borderRadius: 8, border: `1px dashed ${border}`,
                        background: 'transparent', color: muted,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 11, fontWeight: 500,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Ctrl+V to paste
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button onClick={() => setStep('preview')} disabled={!canPreview} style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  background: canPreview ? brand : (dark ? '#1c3528' : '#dce8e1'),
                  color: canPreview ? '#fff' : muted,
                  fontSize: 13, fontWeight: 600, cursor: canPreview ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  Preview & Submit
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes brm-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
