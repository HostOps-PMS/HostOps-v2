import { useState, useEffect } from 'react';
import { createClient, updateClient } from '../../clients/services/clientsService';
import { toast } from '../../../utils/toast';
import { useTheme } from '../../../context/ThemeContext';

// moved inside component

export default function TeamLeaderModal({ mode, teamLeader, clients, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const { dark } = useTheme();

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1.5px solid ${dark ? '#1e3a2a' : '#e8edf2'}`,
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    background: dark ? '#0d2619' : '#fff',
    color: dark ? '#eaf5f0' : '#0d1117',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: dark ? '#7ab89a' : '#64748b',
    marginBottom: 5,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };

  const [form, setForm] = useState({
    firstName: teamLeader?.firstName || '',
    lastName:  teamLeader?.lastName  || '',
    email:     teamLeader?.email     || '',
    password:  '',
    serverId:  teamLeader?.serverId?._id || teamLeader?.serverId || '',
  });

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

try {
      if (!isEdit) {
        if (!form.password || form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) {
          setError('Password must be at least 8 characters, include 1 uppercase letter, and 1 special character.');
          setSaving(false);
          return;
        }
      }

      const body = {
        firstName: form.firstName,
        lastName:  form.lastName,
        serverId:  form.serverId,
      };

      if (!isEdit) {
        body.email = form.email;
        body.password = form.password;
        body.role = 'team_leader';
        await createClient(body);
        toast.success(`${form.firstName} ${form.lastName} has been added.`, { title: 'Team Leader Created' });
      } else {
        if (form.password) {
          // If password update is supported via another endpoint or same endpoint
          // In the current updateClientSchema, password is NOT updatable via PATCH /api/clients/:id
          // Since it's not supported by the backend right now, we will skip it or just pass it in case.
          // Wait, backend PATCH /api/clients/:id does NOT support password.
          // Let's just avoid sending it to not throw zod errors.
        }
        await updateClient(teamLeader._id, body);
        toast.success(`${form.firstName} ${form.lastName} has been updated.`, { title: 'Team Leader Updated' });
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <style>{`
      @keyframes tl-modal-overlay { from { opacity: 0; } to { opacity: 1; } }
      @keyframes tl-modal-card { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      ${dark ? `.tl-modal input, .tl-modal select { background: #0d2619 !important; color: #eaf5f0 !important; border-color: #1e3a2a !important; }` : ''}
      ${dark ? `.tl-modal input::placeholder { color: #4d8a6a !important; }` : ''}
      ${dark ? `.tl-modal input:disabled, .tl-modal select:disabled { background: #0d2619 !important; color: #4d8a6a !important; }` : ''}
      ${dark ? `.tl-modal option { background: #132a1e; color: #eaf5f0; }` : ''}
    `}</style>
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: dark ? 'rgba(0,0,0,0.65)' : 'rgba(12,28,20,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'tl-modal-overlay 0.2s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="tl-modal"
        style={{
          background: dark ? '#132a1e' : '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          animation: 'tl-modal-card 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{
          padding: '28px 32px 0 32px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{
              fontSize: '1.6rem', fontWeight: 800, color: dark ? '#eaf5f0' : '#0d1117',
              lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
            }}>
              {isEdit ? <>Edit <span style={{ color: '#26a676' }}>Team Leader</span></> : <>Create <span style={{ color: '#26a676' }}>Team Leader</span></>}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: dark ? '#4d8a6a' : '#9ca3af', fontWeight: 400 }}>
              {isEdit ? 'Update the team leader details below.' : 'Fill in the details to create a team leader.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: dark ? '#0d2619' : '#f3f4f6', border: `1px solid ${dark ? '#1e3a2a' : 'transparent'}`, borderRadius: 10,
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: dark ? '#4d8a6a' : '#6b7280',
              fontSize: '1rem', flexShrink: 0, marginTop: 2,
            }}
          >✕</button>
        </div>

        <form id="team-leader-form" onSubmit={handleSubmit} style={{ padding: '20px 32px 0', overflowY: 'auto', flex: 1 }}>

          {/* Profile row — show selected server info */}
          {form.serverId && (() => {
            const c = clients.find(x => x._id === form.serverId);
            if (!c) return null;
            const parts = `${c.firstName} ${c.lastName}`.trim().split(/\s+/);
            const ini = parts.length === 1 ? (parts[0][0] ?? '').toUpperCase() : `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: dark ? '#0d2619' : '#f8faf9', border: `1px solid ${dark ? '#1e3a2a' : '#e5efe9'}`,
                marginBottom: 16,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'linear-gradient(135deg, #26a676, #1d8a62)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
                }}>{ini}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? '#eaf5f0' : '#0d1117' }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 1 }}>{c.email}</div>
                </div>
              </div>
            );
          })()}

          {/* Assigned Server */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Assigned Server (Client) *</label>
            <div style={{ position: 'relative' }}>
              <select
                value={form.serverId}
                onChange={(e) => setForm({ ...form, serverId: e.target.value })}
                required
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', paddingRight: 36 }}
              >
                <option value="" disabled>Select a server</option>
                {clients.map(client => (
                  <option key={client._id} value={client._id}>
                    {client.firstName} {client.lastName} ({client.email})
                  </option>
                ))}
              </select>
              <svg
                width="14" height="14" viewBox="0 0 20 20" fill="none"
                stroke={dark ? '#4d8a6a' : '#9ca3af'} strokeWidth="2.5"
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                value={form.firstName}
                onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.'-]*$/.test(val)) setForm({ ...form, firstName: val }); }}
                required
                style={inputStyle}
                placeholder="Juan"
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.'-]*$/.test(val)) setForm({ ...form, lastName: val }); }}
                style={inputStyle}
                placeholder="Dela Cruz"
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={isEdit}
              style={{ ...inputStyle, cursor: isEdit ? 'not-allowed' : 'text', ...(!isEdit && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? { borderColor: '#ef4444' } : {}) }}
              placeholder="teamleader@example.com"
            />
            {!isEdit && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
              <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Enter a valid email (e.g. teamleader@example.com).</span>
            )}
          </div>

          {!isEdit && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  style={{ ...inputStyle, paddingRight: 40, ...(form.password && (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) ? { borderColor: '#ef4444' } : { borderColor: '#26a676' }) }}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                {form.password && form.password.length < 8 && (
                  <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ At least 8 characters.</span>
                )}
                {form.password && form.password.length >= 8 && !/[A-Z]/.test(form.password) && (
                  <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Must include at least 1 uppercase letter.</span>
                )}
                {form.password && form.password.length >= 8 && /[A-Z]/.test(form.password) && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) && (
                  <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Must include at least 1 special character (e.g. @, #, !).</span>
                )}
                {form.password && form.password.length >= 8 && /[A-Z]/.test(form.password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) && (
                  <span style={{ color: '#26a676', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>✓ Strong password.</span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: dark ? '#4d8a6a' : '#9ca3af',
                    display: 'flex', alignItems: 'center', padding: 0,
                  }}
                >
                  <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 8, padding: '10px 14px',
              fontSize: '.8125rem', fontWeight: 500, marginBottom: 14,
            }}>
              ⚠️ {error}
            </div>
          )}

          </form>

        {/* Footer */}
        <div style={{
          padding: '16px 32px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10,
          borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`,
          background: dark ? '#132a1e' : '#fff',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 22px', borderRadius: 10,
              border: `1.5px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? 'transparent' : '#fff',
              fontSize: '0.875rem', fontWeight: 600, color: dark ? '#7ab89a' : '#374151',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="team-leader-form"
            disabled={saving}
            style={{
              padding: '9px 26px', borderRadius: 10,
              border: 'none', background: saving ? '#9ca3af' : '#0d1117',
              fontSize: '0.875rem', fontWeight: 700, color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Team Leader'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
