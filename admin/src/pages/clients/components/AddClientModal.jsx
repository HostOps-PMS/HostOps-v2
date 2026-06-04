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
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
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
    >
      <div className="db-modal" style={{ width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="db-modal__head">
          <span className="db-modal__title">Add Business</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="db-modal__body" style={{ overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: '.8125rem', fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Account fields ── */}
          <Field label="Business Name" required>
            <input
              type="text"
              placeholder="Example Business Inc."
              value={form.businessName}
              onChange={setField('businessName')}
              maxLength={100}
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              placeholder="contact@example.com"
              value={form.email}
              onChange={setField('email')}
              maxLength={254}
            />
          </Field>

          <Field label="Password" required>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={setField('password')}
                maxLength={128}
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--color-muted)', cursor: 'pointer',
                  padding: 0, display: 'grid', placeItems: 'center',
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l14 14M10 5C5.5 5 2 10 2 10s1.3 2 3.5 3.5M10 15c4.5 0 8-5 8-5s-1.3-2-3.5-3.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" />
                    <circle cx="10" cy="10" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          <Field label="Temporary 6-Digit PIN" required>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="Exactly 6 digits"
              value={form.pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setForm((f) => ({ ...f, pin: val }));
              }}
              style={{ width: '100%' }}
            />
          </Field>

          {/* ── Properties section ── */}
          <Divider label="Properties" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {properties.map((prop, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid var(--color-border, #e5e9ec)',
                  borderRadius: 'var(--radius-md, 10px)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: 'var(--color-surface-2, #f8faf9)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: '.75rem', fontWeight: 600,
                    color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                  }}>
                    Property {index + 1}
                  </span>
                  {properties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProperty(index)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--color-danger, #b91c1c)', cursor: 'pointer',
                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        fontSize: '.75rem', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                      </svg>
                      Remove
                    </button>
                  )}
                </div>

                <div className="db-field" style={{ margin: 0 }}>
                  <label>
                    Property Name
                    <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunset Villas"
                    value={prop.name}
                    onChange={setProp(index, 'name')}
                    maxLength={150}
                  />
                </div>

                <div className="db-field" style={{ margin: 0 }}>
                  <label>Smoobu API Key</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={prop.smoobuApiKey}
                    onChange={setProp(index, 'smoobuApiKey')}
                    maxLength={512}
                  />
                </div>

                <div className="db-field" style={{ margin: 0 }}>
                  <label>Property Picture</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {prop.pictureUrl ? (
                      <img src={prop.pictureUrl} alt="Preview" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#c8ddd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#26a676', fontWeight: 'bold' }}>
                        {prop.name ? prop.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    <label style={{ cursor: 'pointer', color: 'var(--color-brand)', fontSize: '.8125rem', fontWeight: 600 }}>
                      Upload Picture
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            const url = URL.createObjectURL(file);
                            setProperties((prev) =>
                              prev.map((p, i) => (i === index ? { ...p, pictureFile: file, originalPictureUrl: url } : p))
                            );
                            setCropImageUrl(url);
                            setInitialCropData(null);
                            setCroppingIndex(index);
                          }
                          e.target.value = null;
                        }} 
                      />
                    </label>
                    {prop.pictureUrl && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setCropImageUrl(prop.originalPictureUrl);
                          setInitialCropData(prop.cropData);
                          setCroppingIndex(index);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-brand)', fontSize: '.8125rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Adjust Picture
                      </button>
                    )}
                    {prop.pictureUrl && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setProperties((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, pictureFile: null, pictureUrl: null, originalPictureUrl: null, cropData: null } : p))
                          );
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: '.8125rem', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add another property */}
          <button
            type="button"
            onClick={addProperty}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '9px 0',
              border: '1.5px dashed var(--color-border, #c8ddd5)',
              borderRadius: 'var(--radius-md, 10px)',
              background: 'transparent',
              color: 'var(--color-brand, #26a676)',
              fontSize: '.8125rem', fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2, #f0f7f4)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            Add Another Property
          </button>
        </div>

        {/* Footer */}
        <div className="db-modal__foot">
          <button className="db-btn db-btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="db-btn db-btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ minWidth: 130 }}
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