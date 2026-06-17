import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import safeStorage from '../../safeStorage';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.hostops.online').replace(/\/$/, '');
const API_KEY  = import.meta.env.VITE_API_KEY || '';

function getUser() {
  try { return JSON.parse(safeStorage.getItem('hp_user') || 'null'); } catch { return null; }
}

const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: '#22c55e', desc: 'Minor visual issue' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b', desc: 'Feature not working properly' },
  { value: 'high',     label: 'High',     color: '#f97316', desc: 'Major feature broken' },
  { value: 'critical', label: 'Critical', color: '#ef4444', desc: 'System unusable / data loss' },
];

export default function BugReportModal({ show, onClose }) {
  const { dark } = useDashboard();
  const user = getUser();
  const [description, setDescription] = useState('');
  const [page, setPage]               = useState('');
  const [severity, setSeverity]       = useState('medium');
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState('');

  if (!show) return null;

  const minLength = 10;
  const canSubmit = description.trim().length >= minLength && !loading;

  const bg      = dark ? '#132a1e' : '#ffffff';
  const border  = dark ? '#1e3a2a' : '#e3ede8';
  const text    = dark ? '#eaf5f0' : '#0c1c14';
  const muted   = dark ? '#7ab89a' : '#6b7280';
  const inputBg = dark ? '#0d2619' : '#f8fbf9';

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/bug-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          email:       user?.email || '',
          name:        user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
          page,
          severity,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setDescription('');
    setPage('');
    setSeverity('medium');
    setSubmitted(false);
    setError('');
    onClose();
  }

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(2px)',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: bg, borderRadius: 20, padding: '28px 24px 24px',
          width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative', animation: 'bugmodal-in 0.22s ease',
          border: `1px solid ${border}`, maxHeight: '90vh', overflowY: 'auto',
        }}>
          {/* Close */}
          <button onClick={handleClose} style={{
            position: 'absolute', top: 14, right: 14, background: 'none',
            border: 'none', cursor: 'pointer', color: muted, fontSize: 18, padding: 4, lineHeight: 1,
          }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: dark ? '#0d2619' : '#eaf8f1', border: `1.5px solid #26a676`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#26a676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: '0 0 10px' }}>Report Submitted</h2>
              <p style={{ color: muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Thank you! Our team will review your bug report and take action as soon as possible.
              </p>
              <button onClick={handleClose} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #26a676, #1e8760)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Close</button>
            </div>
          ) : (
            <>
              {/* Header */}
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
                  Page or feature affected
                </label>
                <input
                  value={page}
                  onChange={e => setPage(e.target.value)}
                  placeholder="e.g. Dashboard, Bookings, Calendar…"
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
                  What happened?
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the bug — what you did, what you expected, and what actually happened…"
                  rows={4}
                  maxLength={2000}
                  disabled={loading}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
                    border: `1.5px solid ${border}`, fontSize: 14, color: text,
                    background: inputBg, outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', lineHeight: 1.5, transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#26a676'; }}
                  onBlur={e => { e.target.style.borderColor = border; }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: muted }}>
                  <span>{description.trim().length < minLength ? `At least ${minLength} characters required` : ''}</span>
                  <span>{description.length}/2000</span>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                  background: dark ? '#2a0d0d' : '#fef2f2', border: `1px solid ${dark ? '#5c1a1a' : '#fecaca'}`,
                  color: dark ? '#f87171' : '#dc2626', fontSize: 13,
                }}>{error}</div>
              )}

              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                background: canSubmit ? 'linear-gradient(135deg, #26a676, #1e8760)' : (dark ? '#1e3a2a' : '#e5e7eb'),
                color: canSubmit ? '#fff' : (dark ? '#4d8a6a' : '#9ca3af'),
                fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', marginBottom: 8, transition: 'all 0.15s',
                boxShadow: canSubmit ? '0 2px 8px rgba(38,166,118,0.3)' : 'none',
              }}>{loading ? 'Submitting…' : 'Submit Bug Report'}</button>

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
