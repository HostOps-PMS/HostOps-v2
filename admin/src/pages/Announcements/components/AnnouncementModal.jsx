import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { getClients } from '../../clients/services/clientsService';

function toInputDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export default function AnnouncementModal({ announcement, onClose, onSave, loading: externalLoading }) {
  const { dark } = useTheme();
  const isEdit = !!announcement;
  const fileRef = useRef(null);
  const dropdownRef = useRef(null);

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1.5px solid ${dark ? '#1e3a2a' : '#e8edf2'}`,
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    background: dark ? '#0d2619' : '#f8fafc',
    color: dark ? '#eaf5f0' : '#0f172a',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: dark ? '#7ab89a' : '#64748b',
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const [title, setTitle]         = useState(announcement?.title || '');
  const [content, setContent]     = useState(announcement?.content || '');
  const [audience, setAudience]   = useState(announcement?.audience || 'all');
  const [priority, setPriority]   = useState(announcement?.priority || 'normal');
  const [status, setStatus]       = useState(announcement?.status || 'draft');
  const [startDate, setStartDate] = useState(toInputDate(announcement?.startDate));
  const [endDate, setEndDate]     = useState(toInputDate(announcement?.endDate));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(announcement?.image?.url || '');
  const [removeImage, setRemoveImage]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const [selectedClients, setSelectedClients] = useState(() => {
    if (!announcement?.targetClients?.length) return [];
    return announcement.targetClients.map(c => typeof c === 'string' ? c : c._id);
  });
  const [clientList, setClientList]         = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [clientSearch, setClientSearch]     = useState('');

  useEffect(() => {
    let cancelled = false;
    setClientsLoading(true);
    getClients().then(data => {
      if (cancelled) return;
      const list = Array.isArray(data) ? data : (data?.clients ?? data?.users ?? data?.data ?? []);
      setClientList(list.filter(c => c.role === 'client'));
    }).catch(() => {}).finally(() => { if (!cancelled) setClientsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || '');
      setContent(announcement.content || '');
      setAudience(announcement.audience || 'all');
      setPriority(announcement.priority || 'normal');
      setStatus(announcement.status || 'draft');
      setStartDate(toInputDate(announcement.startDate));
      setEndDate(toInputDate(announcement.endDate));
      setImagePreview(announcement.image?.url || '');
      setImageFile(null);
      setRemoveImage(false);
      setSelectedClients(
        (announcement.targetClients || []).map(c => typeof c === 'string' ? c : c._id)
      );
    }
  }, [announcement]);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setClientSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  function toggleClient(id) {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(), content: content.trim(),
          audience, priority, status, startDate, endDate, removeImage,
          targetClients: audience === 'selected' ? selectedClients : [],
        },
        imageFile,
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || externalLoading;

  const filteredClients = clientList.filter(c =>
    !clientSearch || c.businessName?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  function clientName(id) {
    const c = clientList.find(x => x._id === id);
    return c?.businessName || id;
  }

  return (
    <>
      <style>{`
        @keyframes ann-modal-overlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ann-modal-card { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: dark ? 'rgba(0,0,0,0.65)' : 'rgba(12,28,20,0.45)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'ann-modal-overlay 0.2s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      >
        <div
          style={{
            background: dark ? '#132a1e' : '#fff',
            borderRadius: 20, width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            border: 'none', display: 'flex', flexDirection: 'column',
            animation: 'ann-modal-card 0.28s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '28px 32px 0 32px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{
                fontSize: '1.6rem', fontWeight: 800,
                color: dark ? '#eaf5f0' : '#0d1117',
                lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
              }}>
                {isEdit
                  ? <>Edit <span style={{ color: '#26a676' }}>Announcement</span></>
                  : <>New <span style={{ color: '#26a676' }}>Announcement</span></>}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: dark ? '#4d8a6a' : '#9ca3af', fontWeight: 400 }}>
                {isEdit ? 'Update the announcement details below.' : 'Fill in the details to create an announcement.'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              style={{
                background: dark ? '#0d2619' : '#f3f4f6',
                border: `1px solid ${dark ? '#1e3a2a' : 'transparent'}`,
                borderRadius: 10, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: busy ? 'not-allowed' : 'pointer',
                color: dark ? '#4d8a6a' : '#6b7280',
                fontSize: '1rem', flexShrink: 0, marginTop: 2,
              }}
            >✕</button>
          </div>

          {/* Body */}
          <form id="ann-form" onSubmit={handleSubmit} style={{ padding: '20px 32px 0', overflowY: 'auto', flex: 1 }}>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                maxLength={200}
                required
                style={inputStyle}
              />
            </div>

            {/* Content */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Content *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the announcement content…"
                maxLength={5000}
                required
                rows={5}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Image */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Image</label>
              {imagePreview ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  border: `1.5px solid ${dark ? '#1e3a2a' : '#e8edf2'}`,
                  background: dark ? '#0d2619' : '#f8fafc',
                }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      width: 48, height: 48, borderRadius: 8, objectFit: 'cover',
                      flexShrink: 0, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: dark ? '#eaf5f0' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageFile ? imageFile.name : 'Current image'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 2 }}>
                      {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : 'Click change to replace'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        padding: '5px 12px', borderRadius: 7,
                        border: `1.5px solid ${dark ? '#1e3a2a' : '#e8edf2'}`,
                        background: dark ? '#132a1e' : '#fff',
                        fontSize: '0.75rem', fontWeight: 600,
                        color: dark ? '#7ab89a' : '#374151', cursor: 'pointer',
                      }}
                    >Change</button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        padding: '5px 12px', borderRadius: 7,
                        border: '1.5px solid #fca5a5',
                        background: dark ? '#2d0a0a' : '#fff5f5',
                        fontSize: '0.75rem', fontWeight: 600,
                        color: dark ? '#f87171' : '#dc2626', cursor: 'pointer',
                      }}
                    >Remove</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '20px 16px', borderRadius: 10,
                    border: `2px dashed ${dark ? '#1e3a2a' : '#d1d5db'}`,
                    background: dark ? '#0d2619' : '#f8fafc',
                    color: dark ? '#4d8a6a' : '#9ca3af',
                    cursor: 'pointer', fontSize: '0.83rem', fontWeight: 500,
                    width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="2" width="16" height="16" rx="3" />
                    <circle cx="7" cy="7" r="2" />
                    <path d="M2 14l4-4 3 3 4-5 5 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Click to upload image
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>

            {/* Audience */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Audience</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle}>
                <option value="all">All Clients</option>
                <option value="selected">Selected Clients</option>
              </select>
            </div>

            {/* Client multi-select */}
            {audience === 'selected' && (
              <div style={{ marginBottom: 14, position: 'relative' }} ref={dropdownRef}>
                <label style={labelStyle}>Select Clients</label>

                {selectedClients.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {selectedClients.map(id => (
                      <span key={id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 999,
                        background: dark ? '#0d2619' : '#d1fae5',
                        color: dark ? '#4ade80' : '#059669',
                        fontSize: '0.78rem', fontWeight: 600,
                      }}>
                        {clientName(id)}
                        <button type="button" onClick={() => toggleClient(id)} style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          color: 'inherit', fontSize: 14, lineHeight: 1, display: 'flex',
                        }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  onClick={() => setShowDropdown(v => !v)}
                  style={{
                    ...inputStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', userSelect: 'none',
                    color: selectedClients.length ? (dark ? '#eaf5f0' : '#0f172a') : (dark ? '#4d8a6a' : '#94a3b8'),
                  }}
                >
                  <span>{selectedClients.length ? `${selectedClients.length} client${selectedClients.length !== 1 ? 's' : ''} selected` : 'Choose clients…'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {showDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    zIndex: 300, background: dark ? '#132a1e' : '#fff',
                    border: `1.5px solid ${dark ? '#1e3a2a' : '#e2e8f0'}`, borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    maxHeight: 260,
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f0f0'}` }}>
                      <input
                        autoFocus
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                        placeholder="Search business…"
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '6px 10px', borderRadius: 6,
                          border: `1.5px solid ${dark ? '#1e3a2a' : '#e2e8f0'}`,
                          fontSize: '0.83rem', outline: 'none',
                          background: dark ? '#0d2619' : '#fafafa',
                          color: dark ? '#eaf5f0' : '#0f172a',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', flex: 1 }}>
                      {clientsLoading ? (
                        <div style={{ padding: '12px 14px', fontSize: '0.83rem', color: dark ? '#4d8a6a' : '#a0aec0', textAlign: 'center' }}>Loading…</div>
                      ) : filteredClients.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: '0.83rem', color: dark ? '#4d8a6a' : '#a0aec0', textAlign: 'center' }}>No clients found</div>
                      ) : filteredClients.map(c => {
                        const checked = selectedClients.includes(c._id);
                        return (
                          <div
                            key={c._id}
                            onClick={() => toggleClient(c._id)}
                            style={{
                              padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                              background: checked ? (dark ? '#1e3a2a' : '#f0fdf4') : 'transparent',
                              color: checked ? (dark ? '#eaf5f0' : '#0d1117') : (dark ? '#7ab89a' : '#2d3748'),
                              fontWeight: checked ? 600 : 400,
                              borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = checked ? (dark ? '#1e3a2a' : '#f0fdf4') : 'transparent'; }}
                          >
                            <div style={{ overflow: 'hidden', minWidth: 0 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{c.businessName}</div>
                              <div style={{ fontSize: '0.72rem', color: dark ? '#4d8a6a' : '#718096', marginTop: 1 }}>{c.email}</div>
                            </div>
                            {checked && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#26a676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="2,6 5,9 10,3" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Priority + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Start Date + End Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
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
              disabled={busy}
              style={{
                padding: '9px 22px', borderRadius: 10,
                border: `1.5px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                background: dark ? 'transparent' : '#fff',
                fontSize: '0.875rem', fontWeight: 600,
                color: dark ? '#7ab89a' : '#374151',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="ann-form"
              disabled={busy || !title.trim() || !content.trim()}
              style={{
                padding: '9px 26px', borderRadius: 10,
                border: 'none',
                background: (busy || !title.trim() || !content.trim()) ? '#9ca3af' : '#0d1117',
                fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                cursor: (busy || !title.trim() || !content.trim()) ? 'not-allowed' : 'pointer',
                boxShadow: (busy || !title.trim() || !content.trim()) ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
              }}
            >
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
