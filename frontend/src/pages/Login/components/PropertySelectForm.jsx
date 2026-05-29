import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────
// PropertySelectForm
//
// Shown after OTP verification (non-admin users only).
// Fetches the client's Smoobu properties and lets them choose ONE
// property to log into via staff domain login.
//
// The selected property's Smoobu apartment ID is stored as a STRING
// (coerced with String()) and passed back to the parent via onContinue(id).
// DomainLoginForm also coerces to String() before comparing with
// staff.propertyIds so the types always match.
// ─────────────────────────────────────────────────────────────────
export default function PropertySelectForm({ userData, showMsg, hideMsg, onContinue, onBack }) {
  const auth = useAuth();

  const [properties, setProperties]               = useState([]);
  const [loadingProps, setLoadingProps]           = useState(true);
  const [smoobuNotConnected, setSmoobuNotConnected] = useState(false);

  // Single selection — stores the Smoobu apartment ID coerced to STRING, or null
  const [selectedId, setSelectedId] = useState(null);

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

        // /api/properties returns { properties: [...] }
        // getApartments() inside the route returns { apartments: [...] }
        // Accept both shapes to be safe.
        const list = data.apartments || data.properties || [];
        setProperties(list);
      } catch {
        if (!cancelled) setSmoobuNotConnected(true);
      } finally {
        if (!cancelled) setLoadingProps(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Continue — pass selected Smoobu apartment ID (as string) to parent ──
  const handleContinue = () => {
    if (!selectedId) return;
    // Always pass as string so DomainLoginForm comparison is consistent
    onContinue(String(selectedId));
  };

  const canContinue = !loadingProps && selectedId !== null;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <h1 className="lp-h1">Select Property</h1>
      <p className="lp-sub">
        {userData?.firstName ? `Hi ${userData.firstName}! ` : ''}
        Choose the property you want to log into.
      </p>

      {/* ── Property list ── */}
      <div
        style={{
          margin: '20px 0',
          maxHeight: '300px',
          overflowY: 'auto',
          paddingRight: '2px',
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
        ) : smoobuNotConnected ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: '#9ab8a9', fontSize: '13px', margin: 0 }}>
              No Smoobu account connected. Please contact your administrator.
            </p>
          </div>
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: '#9ab8a9', fontSize: '13px', margin: 0 }}>
              No properties found on your account.
            </p>
          </div>
        ) : (
          properties.map((prop) => (
            <PropertyCard
              key={prop.id}
              label={prop.name}
              // Compare as strings — Smoobu returns id as number, selectedId stored as string
              isSelected={String(selectedId) === String(prop.id)}
              onClick={() => setSelectedId(String(prop.id))}
            />
          ))
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
// PropertyCard — individual selectable row (radio-style, single select)
// ─────────────────────────────────────────────────────────────────
function PropertyCard({ label, sublabel, isSelected, onClick }) {
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
      {/* Radio indicator */}
      <div
        style={{
          flexShrink:      0,
          width:           '20px',
          height:          '20px',
          borderRadius:    '50%',
          border:          `2px solid ${isSelected ? '#26a676' : '#b8d4c4'}`,
          background:      isSelected ? '#26a676' : 'transparent',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          transition:      'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {isSelected && (
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'white',
          }} />
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