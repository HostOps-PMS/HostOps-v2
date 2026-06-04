import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://hostpilot-smoobu.onrender.com';

// ─────────────────────────────────────────────────────────────────
// PropertySelectForm
//
// Shown after OTP verification (non-admin users only).
// Fetches the client's embedded properties from /auth/my-properties
// (user.properties[] in the User model — propertyName + _id).
//
// After the user selects a property and taps Continue:
//   - Calls onPropertySelected(propertyId, propertyName) so the parent
//     (LoginPage / index.jsx) can store the selection and advance to the
//     PIN gate (PinModal). Navigation to /dashboard is handled by PinModal
//     on successful PIN verification — NOT here.
//
// Props:
//   userData          {object}  - user / clientAccount object from authData
//   isClientAccount   {boolean} - true for clientAccount sessions
//   showMsg           {fn}
//   hideMsg           {fn}
//   onPropertySelected {fn}     - called with (propertyId, propertyName) on Continue
//   onContinue        {fn}      - legacy fallback (kept for safety, not called in normal flow)
//   onBack            {fn}
// ─────────────────────────────────────────────────────────────────
export default function PropertySelectForm({ userData, isClientAccount, showMsg, hideMsg, onPropertySelected, onContinue, onBack }) {
  const auth = useAuth();
  const navigate = useNavigate(); // kept in case a future code path needs it

  const [properties, setProperties]     = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [fetchError, setFetchError]     = useState(false);

  // Stores the selected property _id as a STRING, or null
  const [selectedId, setSelectedId] = useState(null);

  // ── Fetch properties on mount ────────────────────────────────────
  useEffect(() => {
    hideMsg();
    let cancelled = false;

    async function load() {
      try {
        const token = auth.getToken();
        const res = await fetch(`${API_BASE}/auth/my-properties`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-api-key': import.meta.env.VITE_API_KEY || '',
          },
        });

        if (cancelled) return;

        if (!res.ok) {
          setFetchError(true);
          return;
        }

        const data = await res.json();
        const list = data.properties || [];
        setProperties(list);
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoadingProps(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Continue ──────────────────────────────────────────────────────
  // Passes the selected property _id and name up to the parent so it can
  // advance to PinModal. The parent stores them in sessionStorage.
  const handleContinue = () => {
    if (!selectedId) return;

    const prop = properties.find((p) => String(p._id) === selectedId);
    const propertyName = prop?.propertyName || '';

    if (onPropertySelected) {
      // ── New path: parent handles sessionStorage + navigation via PinModal
      onPropertySelected(selectedId, propertyName);
    } else {
      // ── Legacy fallback (onContinue) — not used in normal flow
      sessionStorage.setItem('hp_selected_property_id',   selectedId);
      sessionStorage.setItem('hp_selected_property_name', propertyName);
      onContinue?.(selectedId);
    }
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
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: '#9ab8a9', fontSize: '13px', margin: 0 }}>
              Unable to load properties. Please contact your administrator.
            </p>
          </div>
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: '#9ab8a9', fontSize: '13px', margin: 0 }}>
              No properties found on your account.
            </p>
          </div>
        ) : (
          <>
            {properties.map((prop) => (
              <PropertyCard
                key={prop._id}
                label={prop.propertyName}
                isSelected={selectedId === String(prop._id)}
                onClick={() => setSelectedId(String(prop._id))}
              />
            ))}
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