import { useState, useEffect, useRef } from 'react';
import { updateAdminProfile } from '../services/profileService';

export default function AccountSettingsModal({ isOpen, onClose, onSaved }) {
  const getUser = () => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  };

  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
  const [errorMsg, setErrorMsg] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const user = getUser();
      setForm({ firstName: user.firstName || '', lastName: user.lastName || '' });
      setStatus(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const user = getUser();
  const initials = [user.firstName, user.lastName].filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
  const formattedLastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  }

  async function handleSave() {
    if (!form.firstName.trim()) {
      setErrorMsg('First name is required.');
      setStatus('error');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const data = await updateAdminProfile(form);
      const updated = { ...user, ...data.user, ...form };
      sessionStorage.setItem('hp_user', JSON.stringify(updated));
      setStatus('success');
      onSaved?.(updated);
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.');
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .adm-acc-input:focus { border-color: #1a9e6e !important; box-shadow: 0 0 0 3px rgba(26,158,110,0.10) !important; }
        .adm-acc-close:hover { background: #f5f5f5 !important; }
        .adm-acc-cancel:hover { background: #f5f5f5 !important; }
        .adm-acc-save:hover:not(:disabled) { background: #333 !important; }
      `}</style>

      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          role="dialog" aria-modal="true" aria-label="Account Settings"
          style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460,
            overflow: 'hidden', animation: 'modalSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          }}
        >
          {/* Header */}
          <div style={{ padding: '22px 24px 18px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a9e6e, #0d7a55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>Account Settings</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Update your profile information</div>
              </div>
            </div>
            <button
              className="adm-acc-close"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: '0.5px solid rgba(0,0,0,0.12)',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#888', fontSize: 14, transition: 'background 0.15s',
              }}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            {/* Read-only info */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#bbb', textTransform: 'uppercase', marginBottom: 10 }}>Account Info</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'EMAIL', value: user.email || '—' },
                { label: 'ROLE', value: user.role || 'admin' },
                { label: 'LAST LOGIN', value: formattedLastLogin },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', background: '#f9f9f9',
                  borderRadius: 9, border: '0.5px solid rgba(0,0,0,0.06)',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#bbb', letterSpacing: '0.06em' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Editable fields */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#bbb', textTransform: 'uppercase', marginBottom: 10 }}>Edit Profile</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { name: 'firstName', label: 'First Name', placeholder: 'First name' },
                { name: 'lastName',  label: 'Last Name',  placeholder: 'Last name' },
              ].map(({ name, label, placeholder }) => (
                <div key={name}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 5 }}>{label}</label>
                  <input
                    className="adm-acc-input"
                    type="text"
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    maxLength={50}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 9,
                      border: '1.5px solid #e0e0e0', fontSize: 13, color: '#111',
                      background: '#fff', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 24px 20px',
            borderTop: '0.5px solid rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>
              {status === 'success' && <span style={{ color: '#1a9e6e' }}>✓ Changes saved successfully.</span>}
              {status === 'error'   && <span style={{ color: '#e05555' }}>✕ {errorMsg}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="adm-acc-cancel"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 9,
                  border: '0.5px solid rgba(0,0,0,0.12)',
                  background: 'transparent', fontSize: 13, fontWeight: 600,
                  color: '#555', cursor: 'pointer', transition: 'background 0.15s',
                }}
              >Cancel</button>
              <button
                className="adm-acc-save"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 20px', borderRadius: 9, border: 'none',
                  background: saving ? '#aaa' : '#1a1a1a',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
              >
                {saving
                  ? <><span style={{ fontSize: 13, animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span> Saving…</>
                  : '✓ Save changes'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}