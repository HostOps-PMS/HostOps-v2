import { useState, useEffect } from 'react';
import { fetchClientProperties, createStaff, updateStaff } from '../../../Staffs/services/staffApi';

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: '#fafafa', color: '#1a202c', transition: 'border-color 0.15s' };
const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#4a5568', marginBottom: 5, letterSpacing: '0.03em', textTransform: 'uppercase' };

export default function StaffModal({ mode, staff, serverId, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    firstName:   staff?.firstName || '',
    lastName:    staff?.lastName  || '',
    email:       staff?.email     || '',
    password:    '',
    propertyIds: staff?.propertyIds || [],
    isActive:    staff?.isActive !== false,
  });

  const [properties, setProperties]    = useState([]);
  const [propsLoading, setPropsLoading] = useState(true);
  const [propsError, setPropsError]    = useState('');
  const [saving, setSaving]            = useState(false);
  const [error, setError]              = useState('');

  useEffect(() => {
    if (!serverId) return;
    setPropsLoading(true);
    setPropsError('');
    fetchClientProperties(serverId)
      .then((data) => {
        setProperties(data.properties || []);
      })
      .catch(() => setPropsError('Failed to load properties.'))
      .finally(() => setPropsLoading(false));
  }, [serverId]);

  function toggleProperty(id) {
    const strId = String(id);
    setForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(strId) ? f.propertyIds.filter((p) => p !== strId) : [...f.propertyIds, strId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        clientId:    serverId,
        firstName:   form.firstName,
        lastName:    form.lastName,
        email:       form.email,
        propertyIds: form.propertyIds,
      };
      if (form.password) body.password = form.password;
      if (isEdit)        body.isActive  = form.isActive;
      if (!isEdit)       body.password  = form.password;

      if (isEdit) {
        await updateStaff(staff._id, body);
      } else {
        await createStaff(body);
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>{isEdit ? 'Edit Staff' : 'Create Staff Account'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required style={inputStyle} placeholder="Juan" />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} placeholder="Dela Cruz" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled={isEdit} style={{ ...inputStyle, cursor: isEdit ? 'not-allowed' : 'text' }} placeholder="staff@example.com" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{isEdit ? 'New Password (leave blank to keep)' : 'Temporary Password *'}</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!isEdit} style={inputStyle} placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 8 characters'} autoComplete="new-password" />
          </div>

          {isEdit && (
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ ...labelStyle, margin: 0 }}>Active</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: form.isActive ? '#26a676' : '#cbd5e0', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: form.isActive ? 20 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Assign Properties</label>
            {propsLoading && <p style={{ fontSize: '0.8rem', color: '#888', margin: '4px 0 0' }}>Loading properties…</p>}
            {propsError && <p style={{ fontSize: '0.8rem', color: '#c13515', margin: '4px 0 0' }}>{propsError}</p>}
            {!propsLoading && !propsError && properties.length > 0 && (
              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {properties.map((prop) => {
                  const checked = form.propertyIds.includes(String(prop.id));
                  return (
                    <label key={prop.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: checked ? '#f0f7ff' : 'transparent', borderBottom: '1px solid #f0f0f0', fontSize: '0.875rem', color: '#2d3748', transition: 'background 0.1s' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleProperty(prop.id)} style={{ accentColor: '#3b5fc0', width: 15, height: 15, flexShrink: 0 }} />
                      <span style={{ fontWeight: checked ? 600 : 400 }}>{prop.propertyName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div style={{ background: '#fff0ee', color: '#c13515', borderRadius: 8, padding: '8px 12px', fontSize: '0.83rem', marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#4a5568', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saving ? '#a0aec0' : '#1555C0', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
