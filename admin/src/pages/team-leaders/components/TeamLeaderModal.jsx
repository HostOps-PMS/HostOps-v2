import { useState, useEffect } from 'react';
import { createClient, updateClient } from '../../clients/services/clientsService';

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid #e2e8f0',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fafafa',
  color: '#1a202c',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#4a5568',
  marginBottom: 5,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
};

export default function TeamLeaderModal({ mode, teamLeader, clients, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    firstName: teamLeader?.firstName || '',
    lastName:  teamLeader?.lastName  || '',
    email:     teamLeader?.email     || '',
    password:  '',
    serverId:  teamLeader?.serverId?._id || teamLeader?.serverId || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
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
      } else {
        if (form.password) {
          // If password update is supported via another endpoint or same endpoint
          // In the current updateClientSchema, password is NOT updatable via PATCH /api/clients/:id
          // Since it's not supported by the backend right now, we will skip it or just pass it in case.
          // Wait, backend PATCH /api/clients/:id does NOT support password.
          // Let's just avoid sending it to not throw zod errors.
        }
        await updateClient(teamLeader._id, body);
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>
            {isEdit ? 'Edit Team Leader' : 'Create Team Leader'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px' }}>
          
          {/* Assigned Server */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Assigned Server (Client) *</label>
            <select
              value={form.serverId}
              onChange={(e) => setForm({ ...form, serverId: e.target.value })}
              required
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="" disabled>Select a server</option>
              {clients.map(client => (
                <option key={client._id} value={client._id}>
                  {client.firstName} {client.lastName} ({client.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                style={inputStyle}
                placeholder="Juan"
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
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
              style={{ ...inputStyle, cursor: isEdit ? 'not-allowed' : 'text' }}
              placeholder="teamleader@example.com"
            />
          </div>

          {!isEdit && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                style={inputStyle}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div style={{
              background: '#fff0ee', color: '#c13515', borderRadius: 8,
              padding: '8px 12px', fontSize: '0.83rem', marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                background: '#fff', color: '#4a5568', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                background: saving ? '#a0aec0' : '#1555C0', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Team Leader'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
