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
  const [clientList, setClientList]       = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [clientSearch, setClientSearch]   = useState('');

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

  const inputStyle = {
    background: dark ? '#0d2619' : undefined,
    color: dark ? '#eaf5f0' : undefined,
    borderColor: dark ? '#1e3a2a' : undefined,
  };

  const filteredClients = clientList.filter(c =>
    !clientSearch || c.businessName?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  function clientName(id) {
    const c = clientList.find(x => x._id === id);
    return c?.businessName || id;
  }

  return (
    <div
      className="db-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div className="db-modal" style={{ width: 600, maxHeight: 'calc(100vh - 48px)', background: dark ? '#132a1e' : undefined }}>
        {/* Header */}
        <div className="db-modal__head" style={{ background: dark ? '#132a1e' : undefined, borderColor: dark ? '#1e3a2a' : undefined }}>
          <div className="db-modal__title" style={{ color: dark ? '#eaf5f0' : undefined }}>
            {isEdit ? 'Edit Announcement' : 'New Announcement'}
          </div>
          <button
            className="db-modal__close"
            onClick={onClose}
            disabled={busy}
            style={{ background: dark ? '#0d2619' : undefined, color: dark ? '#7ab89a' : undefined }}
          >&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="db-modal__body">
            {/* Title */}
            <div className="db-field">
              <label style={{ color: dark ? '#4d8a6a' : undefined }}>Title</label>
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
            <div className="db-field">
              <label style={{ color: dark ? '#4d8a6a' : undefined }}>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the announcement content…"
                maxLength={5000}
                required
                rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px',
                  border: `1px solid ${dark ? '#1e3a2a' : 'var(--color-border, #e5e7eb)'}`,
                  borderRadius: 'var(--radius-sm, 8px)',
                  fontSize: '.875rem', fontFamily: 'var(--font-body, inherit)',
                  color: dark ? '#eaf5f0' : 'var(--color-text, #1a202c)',
                  background: dark ? '#0d2619' : 'var(--color-surface, #fff)',
                  outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            {/* Image upload */}
            <div className="db-field">
              <label style={{ color: dark ? '#4d8a6a' : undefined }}>Image</label>
              {imagePreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={imagePreview} alt="Preview" style={{
                    maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'cover',
                    border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                  }} />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >&times;</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '20px 16px', borderRadius: 10,
                    border: `2px dashed ${dark ? '#1e3a2a' : '#d1d5db'}`,
                    background: dark ? '#0d2619' : '#fafafa',
                    color: dark ? '#4d8a6a' : '#9ca3af',
                    cursor: 'pointer', fontSize: '0.83rem', fontWeight: 500,
                    width: '100%',
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
            <div className="db-field">
              <label style={{ color: dark ? '#4d8a6a' : undefined }}>Audience</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle}>
                <option value="all">All Clients</option>
                <option value="selected">Selected Clients</option>
              </select>
            </div>

            {/* Client multi-select — only visible when audience = selected */}
            {audience === 'selected' && (
              <div className="db-field" style={{ position: 'relative' }} ref={dropdownRef}>
                <label style={{ color: dark ? '#4d8a6a' : undefined }}>Select Clients</label>

                {/* Selected pills */}
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
                        }}>&times;</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown trigger */}
                <div
                  onClick={() => setShowDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', borderRadius: 8,
                    border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                    background: dark ? '#0d2619' : '#fafafa',
                    cursor: 'pointer', fontSize: '0.83rem',
                    color: dark ? '#7ab89a' : '#6b7280',
                  }}
                >
                  <span>{selectedClients.length ? `${selectedClients.length} selected` : 'Choose clients…'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {/* Dropdown list */}
                {showDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    zIndex: 300, background: dark ? '#132a1e' : '#fff',
                    border: `1.5px solid ${dark ? '#1e3a2a' : '#e2e8f0'}`, borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    maxHeight: 260,
                  }}>
                    {/* Search */}
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
                          border: `1.5px solid ${dark ? '#1e3a2a' : '#e2e8f0'}`, fontSize: '0.83rem',
                          outline: 'none', background: dark ? '#0d2619' : '#fafafa',
                          color: dark ? '#eaf5f0' : '#1a202c',
                        }}
                      />
                    </div>
                    {/* List */}
                    <div style={{ maxHeight: 200, overflowY: 'auto', flex: 1 }}>
                      {clientsLoading ? (
                        <div style={{ padding: '12px 14px', fontSize: '0.83rem', color: dark ? '#4d8a6a' : '#a0aec0', textAlign: 'center' }}>
                          Loading…
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: '0.83rem', color: dark ? '#4d8a6a' : '#a0aec0', textAlign: 'center' }}>
                          No clients found
                        </div>
                      ) : filteredClients.map(c => {
                        const checked = selectedClients.includes(c._id);
                        return (
                          <div
                            key={c._id}
                            onClick={() => toggleClient(c._id)}
                            style={{
                              padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                              background: checked ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                              color: checked ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                              fontWeight: checked ? 600 : 400,
                              borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                            }}
                            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = checked ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                          >
                            <div style={{ overflow: 'hidden', minWidth: 0 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.businessName}</div>
                              <div style={{ fontSize: '0.72rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 1 }}>{c.email}</div>
                            </div>
                            {checked && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="2,6 5,9 10,3"/>
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
            <div className="db-modal__row">
              <div className="db-field">
                <label style={{ color: dark ? '#4d8a6a' : undefined }}>Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="db-field">
                <label style={{ color: dark ? '#4d8a6a' : undefined }}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Start Date + End Date */}
            <div className="db-modal__row">
              <div className="db-field">
                <label style={{ color: dark ? '#4d8a6a' : undefined }}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div className="db-field">
                <label style={{ color: dark ? '#4d8a6a' : undefined }}>End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="db-modal__foot" style={{ background: dark ? '#132a1e' : undefined, borderColor: dark ? '#1e3a2a' : undefined }}>
            <button
              type="button"
              className="db-btn db-btn--ghost"
              onClick={onClose}
              disabled={busy}
              style={dark ? { background: '#0d2619', color: '#7ab89a', borderColor: '#1e3a2a' } : {}}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="db-btn db-btn--primary"
              disabled={busy || !title.trim() || !content.trim()}
            >
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
