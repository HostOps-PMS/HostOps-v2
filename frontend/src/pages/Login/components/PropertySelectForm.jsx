import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────
// PropertySelectForm
//
// Shown after OTP verification (non-admin users only).
// Fetches the user's Smoobu properties and lets them choose which
// ones to view on the dashboard.  The selection is persisted to
// sessionStorage as `hp_selected_properties` (either 'all' or an
// array of apartment IDs) before proceeding to Domain Login.
// ─────────────────────────────────────────────────────────────────
export default function PropertySelectForm({ userData, showMsg, hideMsg, onContinue, onBack }) {
  const auth = useAuth();

  const [properties, setProperties]               = useState([]);
  const [loadingProps, setLoadingProps]           = useState(true);
  const [smoobuNotConnected, setSmoobuNotConnected] = useState(false);
  const [allSelected, setAllSelected]             = useState(true);
  const [selected, setSelected]                   = useState(new Set());

  // ── Fetch properties on mount ────────────────────────────────────
  useEffect(() => {
    hideMsg();
    let cancelled = false;

    async function load() {
      try {
        const token = auth.getToken();
        const res = await fetch(`${API_BASE}/api/properties`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-api-key': import.meta.env.VITE_API_KEY || '',
          },
        });

        if (cancelled) return;

        if (!res.ok) {
          setSmoobuNotConnected(true);
          return;
        }

        const data = await res.json();

        if (data.smoobuNotConnected) {
          setSmoobuNotConnected(true);
          return;
        }

        // dashboard.js returns { apartments: [...] }
        // (falls back to data.properties for any future shape changes)
        setProperties(data.apartments || data.properties || []);
      } catch {
        if (!cancelled) setSmoobuNotConnected(true);
      } finally {
        if (!cancelled) setLoadingProps(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Selection helpers ────────────────────────────────────────────
  const handleSelectAll = () => {
    setAllSelected(true);
    setSelected(new Set());
  };

  const handleToggleProperty = (id) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    // If nothing individually selected, fall back to "all"
    if (next.size === 0) {
      setAllSelected(true);
    } else {
      setAllSelected(false);
    }
    setSelected(next);
  };

  // ── Continue ─────────────────────────────────────────────────────
  const handleContinue = () => {
    const value = allSelected ? 'all' : [...selected];
    sessionStorage.setItem('hp_selected_properties', JSON.stringify(value));
    onContinue();
  };

  const canContinue = !loadingProps && (allSelected || selected.size > 0);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <h1 className="lp-h1">Select Properties</h1>
      <p className="lp-sub">
        {userData?.firstName ? `Hi ${userData.firstName}! ` : ''}
        Choose which properties to display on your dashboard.
      </p>

      {/* ── Property list ── */}
      <div
        style={{
          margin: '20px 0',
          maxHeight: '300px',
          overflowY: 'auto',
          paddingRight: '2px', // prevent scrollbar overlap
        }}
      >
        {loadingProps ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              display: 'inline-block',
              width: '22px', height: '22px',
              border: '2px solid #e3ede8',
              borderTopColor: '#26a676',
              borderRadius: '50%',
              animation: 'lp-spin 0.7s linear infinite',
              marginBottom: '10px',
            }} />
            <p style={{ color: '#9ab8a9', fontSize: '13px', margin: 0 }}>
              Loading properties…
            </p>
          </div>
        ) : (
          <>
            {/* All Properties card — always shown */}
            <PropertyCard
              label="All Properties"
              sublabel={
                smoobuNotConnected
                  ? 'No Smoobu account connected'
                  : `${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}`
              }
              isSelected={allSelected}
              isAll
              onClick={handleSelectAll}
            />

            {/* Individual property cards */}
            {!smoobuNotConnected &&
              properties.map((prop) => (
                <PropertyCard
                  key={prop.id}
                  label={prop.name}
                  isSelected={!allSelected && selected.has(prop.id)}
                  onClick={() => handleToggleProperty(prop.id)}
                />
              ))
            }

            {smoobuNotConnected && (
              <p style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#9ab8a9',
                marginTop: '8px',
              }}>
                You can connect your Smoobu account later from Settings.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Continue button ── */}
      <button
        className="lp-btn"
        onClick={handleContinue}
        disabled={!canContinue}
        style={{ width: '100%' }}
      >
        Continue
      </button>

      <button
        type="button"
        className="lp-link"
        onClick={onBack}
        style={{ marginTop: '12px' }}
      >
        ← Back to sign in
      </button>

      {/* Spinner keyframes (injected once) */}
      <style>{`
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// PropertyCard — individual selectable row
// ─────────────────────────────────────────────────────────────────
function PropertyCard({ label, sublabel, isSelected, isAll, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        padding:       '11px 14px',
        marginBottom:  '8px',
        borderRadius:  '12px',
        border:        `2px solid ${isSelected ? '#26a676' : '#e3ede8'}`,
        background:    isSelected ? '#eaf8f1' : '#f8fbf9',
        cursor:        'pointer',
        transition:    'border-color 0.15s ease, background 0.15s ease',
        userSelect:    'none',
        outline:       'none',
      }}
    >
      {/* Checkbox / radio indicator */}
      <div
        style={{
          flexShrink:      0,
          width:           '20px',
          height:          '20px',
          borderRadius:    isAll ? '50%' : '5px',
          border:          `2px solid ${isSelected ? '#26a676' : '#b8d4c4'}`,
          background:      isSelected ? '#26a676' : 'transparent',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          transition:      'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {isSelected && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none" aria-hidden="true">
            <path
              d="M1 4L4 7L10 1"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Labels */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize:     '14px',
            fontWeight:   isSelected ? '600' : '500',
            color:        isSelected ? '#0c1c14' : '#3a5248',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: '12px', color: '#9ab8a9', marginTop: '1px' }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}