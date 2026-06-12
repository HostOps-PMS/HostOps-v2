import { useState } from 'react';
import { createClient } from '../services/clientsService';
import { uploadPropertyPicture } from '../services/clientsService';
import ImageCropModal from './ImageCropModal';

const INITIAL_FORM = {
  businessName: '',
  email:        '',
  password:     '',
  pin:          '',
};

const newProperty = () => ({ name: '', smoobuApiKey: '', pictureFile: null, pictureUrl: null, originalPictureUrl: null, cropData: null });

function Field({ label, required, children }) {
  return (
    <div className="db-field">
      <label>
        {label}
        {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '4px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border, #e5e9ec)' }} />
      <span style={{
        fontSize: '.6875rem', fontWeight: 600, letterSpacing: '.06em',
        color: 'var(--color-muted)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border, #e5e9ec)' }} />
    </div>
  );
}

export default function AddClientModal({ onClose, onSuccess }) {
  const [form,       setForm]       = useState(INITIAL_FORM);
  const [properties, setProperties] = useState([newProperty()]);
  const [showPass,   setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [croppingIndex, setCroppingIndex] = useState(null);
  const [cropImageUrl, setCropImageUrl] = useState(null);
  const [initialCropData, setInitialCropData] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setProp = (index, key) => (e) => {
    const val = e.target.value;
    setProperties((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [key]: val } : p))
    );
  };

  const addProperty = () =>
    setProperties((prev) => [...prev, newProperty()]);

  const removeProperty = (index) =>
    setProperties((prev) => prev.filter((_, i) => i !== index));

  async function handleSubmit() {
    if (!form.businessName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Business name, email, and password are required.');
      return;
    }
    if (form.password && (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password))) {
      setError('Password must be at least 8 characters, include 1 uppercase letter, and 1 special character.');
      return;
    }
    if (!/^\d{6}$/.test(form.pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    for (let i = 0; i < properties.length; i++) {
      if (!properties[i].name.trim()) {
        setError(`Property ${i + 1} name is required.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const payloadProperties = properties.filter((p) => p.name.trim());
      
      const clientRes = await createClient({
        businessName: form.businessName.trim(),
        email:        form.email.trim(),
        password:     form.password,
        pin:          form.pin,
        role:         'client',
        properties:   payloadProperties.map((p) => ({
            propertyName: p.name.trim(),
            smoobuApiKey: p.smoobuApiKey.trim() || '',
          })),
      });

      const createdProperties = clientRes.user?.properties || [];
      
      // Upload property pictures if any
      for (let i = 0; i < payloadProperties.length; i++) {
        if ((payloadProperties[i].pictureFile || payloadProperties[i].cropData) && createdProperties[i]) {
          const propId = createdProperties[i]._id;
          try {
            await uploadPropertyPicture(clientRes.userId || clientRes.user._id, propId, payloadProperties[i].pictureFile, payloadProperties[i].cropData);
          } catch (picErr) {
            console.error('Failed to upload picture for property:', payloadProperties[i].name, picErr);
            // Optionally set a warning, but the client is already created
          }
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.message ?? 'Failed to create business.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="db-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(12,28,20,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    >
      <div className="db-modal" style={{ width: '95vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 0 32px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: '1.6rem', fontWeight: 800, color: '#0d1117',
              lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
            }}>
              Add <span style={{ color: '#26a676' }}>Business</span>
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af', fontWeight: 400 }}>
              Fill in the details to register a new business.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: 10,
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
              fontSize: '1rem', flexShrink: 0, marginTop: 2,
            }}
          >✕</button>
        </div>

        {/* Body */}
        {/* Body */}
        <div className="db-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '20px 32px 8px' }}>
          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: '.8125rem', fontWeight: 500, marginBottom: 12,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e5e9ec', marginBottom: 20 }}>
            <button type="button" onClick={() => setActiveTab('details')} style={{ padding: '8px 20px', fontSize: '.85rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === 'details' ? '#26a676' : '#9ca3af', borderBottom: activeTab === 'details' ? '2px solid #26a676' : '2px solid transparent', marginBottom: -2 }}>Details</button>
            <button type="button" onClick={() => setActiveTab('properties')} style={{ padding: '8px 20px', fontSize: '.85rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === 'properties' ? '#26a676' : '#9ca3af', borderBottom: activeTab === 'properties' ? '2px solid #26a676' : '2px solid transparent', marginBottom: -2 }}>Properties</button>
          </div>

          {/* Details Tab */}
          <div style={{ display: activeTab === 'details' ? 'flex' : 'none', flexDirection: 'column', gap: 0 }} className="cl-modal-edit-form">
            <Field label="Business Name" required>
            <input type="text" placeholder="Example Business Inc." value={form.businessName}
              onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.,'&()-]*$/.test(val)) setForm(f => ({ ...f, businessName: val })); }}
              maxLength={100} className="cl-edit-input"
              style={form.businessName && /[^a-zA-Z\s.,'&()-]/.test(form.businessName) ? { borderColor: '#ef4444' } : {}} />
            {form.businessName && /[^a-zA-Z\s.,'&()-]/.test(form.businessName) && (
              <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Letters and basic punctuation only.</span>
            )}
          </Field>
            <Field label="Email" required>
            <input type="email" placeholder="contact@example.com" value={form.email}
              onChange={setField('email')}
              maxLength={254} className="cl-edit-input"
              style={form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? { borderColor: '#ef4444' } : {}} />
            {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
              <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Enter a valid email address (e.g. user@example.com).</span>
            )}
          </Field>
            <Field label="Password" required>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password}
              onChange={setField('password')} maxLength={128} className="cl-edit-input"
              style={{ width: '100%', paddingRight: 40, ...(form.password && form.password.length < 8 ? { borderColor: '#ef4444' } : {}) }} />
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
                <button type="button" onClick={() => setShowPass((v) => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }} title={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l14 14M10 5C5.5 5 2 10 2 10s1.3 2 3.5 3.5M10 15c4.5 0 8-5 8-5s-1.3-2-3.5-3.5" strokeLinecap="round" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" /><circle cx="10" cy="10" r="2.5" /></svg>
                  )}
                </button>
              </div>
            </Field>
            <Field label="Temporary 6-Digit PIN" required>
              <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="Exactly 6 digits"
            value={form.pin}
            onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 6); setForm((f) => ({ ...f, pin: val })); }}
            className="cl-edit-input"
            style={{ width: '100%', ...(form.pin && form.pin.length > 0 && form.pin.length < 6 ? { borderColor: '#ef4444' } : form.pin.length === 6 ? { borderColor: '#26a676' } : {}) }} />
          {form.pin && form.pin.length > 0 && form.pin.length < 6 && (
            <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ PIN must be exactly 6 digits ({form.pin.length}/6).</span>
          )}
          {form.pin && form.pin.length === 6 && (
            <span style={{ color: '#26a676', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>✓ PIN is valid.</span>
          )}
            </Field>
          </div>

          {/* Properties Tab */}
          <div style={{ display: activeTab === 'properties' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Properties</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {properties.map((prop, index) => (
                <div key={index} style={{ border: '1px solid var(--color-border, #e5e9ec)', borderRadius: 'var(--radius-md, 10px)', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--color-surface-2, #f8faf9)' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} id={`picture-input-${index}`}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        const url = URL.createObjectURL(file);
                        setProperties((prev) => prev.map((p, i) => (i === index ? { ...p, pictureFile: file, originalPictureUrl: url } : p)));
                        setCropImageUrl(url); setInitialCropData(null); setCroppingIndex(index);
                      }
                      e.target.value = null;
                    }}
                  />
                  <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: prop.pictureUrl ? 'transparent' : 'linear-gradient(135deg, rgba(198,221,213,0.3), rgba(38,166,118,0.05))', border: prop.pictureUrl ? 'none' : '2px dashed #c8ddd5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => document.getElementById(`picture-input-${index}`).click()}>
                    {prop.pictureUrl ? (
                      <img src={prop.pictureUrl} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#26a676', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        </div>
                        <span style={{ fontSize: '.65rem', color: '#26a676', fontWeight: 600 }}>Upload</span>
                      </div>
                    )}
                  </div>
                  <input type="text" placeholder="Property name *" value={prop.name}
                  onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.,'&()-]*$/.test(val)) setProperties(prev => prev.map((p, i) => i === index ? { ...p, name: val } : p)); }}
                  maxLength={150} className="cl-edit-input"
                  style={{ fontSize: '.8rem', textAlign: 'center', ...(prop.name && /[^a-zA-Z\s.,'&()-]/.test(prop.name) ? { borderColor: '#ef4444' } : {}) }} />
                {prop.name && /[^a-zA-Z\s.,'&()-]/.test(prop.name) && (
                  <span style={{ color: '#ef4444', fontSize: '.65rem', fontWeight: 600, textAlign: 'center', display: 'block' }}>⚠ Letters only.</span>
                )}
                  <input type="text" placeholder="Smoobu API Key (optional)" value={prop.smoobuApiKey} onChange={setProp(index, 'smoobuApiKey')} maxLength={512} className="cl-edit-input" style={{ fontSize: '.75rem' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {prop.pictureUrl && (
                      <button type="button" onClick={() => { setCropImageUrl(prop.originalPictureUrl); setInitialCropData(prop.cropData); setCroppingIndex(index); }} style={{ flex: 1, fontSize: '.7rem', padding: '4px 0', border: '1px solid #e5e9ec', borderRadius: 6, background: 'white', color: '#26a676', cursor: 'pointer', fontWeight: 600 }}>Adjust</button>
                    )}
                    {properties.length > 1 && (
                      <button type="button" onClick={() => removeProperty(index)} style={{ flex: 1, fontSize: '.7rem', padding: '4px 0', border: '1px solid #fecaca', borderRadius: 6, background: 'white', color: '#b91c1c', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addProperty}
              style={{ width: '100%', marginTop: 4, padding: '9px 0', border: '1.5px dashed var(--color-border, #c8ddd5)', borderRadius: 'var(--radius-md, 10px)', background: 'transparent', color: 'var(--color-brand, #26a676)', fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background .15s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2, #f0f7f4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
              Add Another Property
            </button>
          </div>
        </div>
                      

        {/* Footer */}
        <div style={{
          padding: '16px 32px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10,
          borderTop: '1px solid #f0f2f5',
          marginTop: 4,
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 22px', borderRadius: 10,
              border: '1.5px solid #e5e7eb', background: '#fff',
              fontSize: '0.875rem', fontWeight: 600, color: '#374151',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '9px 26px', borderRadius: 10,
              border: 'none', background: submitting ? '#9ca3af' : '#0d1117',
              fontSize: '0.875rem', fontWeight: 700, color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
              minWidth: 130,
            }}
          >
            {submitting ? 'Creating…' : 'Add Business'}
          </button>
        </div>
      </div>

      {croppingIndex !== null && cropImageUrl && (
        <ImageCropModal
          imageUrl={cropImageUrl}
          initialCropData={initialCropData}
          onClose={() => {
            setCroppingIndex(null);
            setCropImageUrl(null);
            setInitialCropData(null);
          }}
          onSave={(cropData, previewBlob) => {
            const url = URL.createObjectURL(previewBlob);
            setProperties((prev) =>
              prev.map((p, i) => (i === croppingIndex ? { ...p, cropData, pictureUrl: url } : p))
            );
            setCroppingIndex(null);
            setCropImageUrl(null);
            setInitialCropData(null);
          }}
        />
      )}
    </div>
  );
}
