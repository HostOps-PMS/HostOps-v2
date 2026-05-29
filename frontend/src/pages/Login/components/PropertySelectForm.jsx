import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────
// PropertySelectForm
//
// Shown after OTP verification (non-admin users only).
// Fetches the client's Smoobu properties and lets them choose ONE
// property to log into via staff domain login.
//
// When isClientAccount=true, an "All Properties" option is shown at
// the top. Selecting it sets selectedId to '__all__' which maps to
// selectedPropertyId: null in DashboardContext (= show everything).
// Selecting a specific property stores its ID and name so the
// dashboard scopes to that single property.
//
// The selected property's Smoobu apartment ID is stored as a STRING
// (coerced with String()) and passed back to the parent via onContinue(id).
// DomainLoginForm also coerces to String() before comparing with
// staff.propertyIds so the types always match.
//
// ALL PROPERTIES FLOW:
//   - "All Properties" is always shown at the top for all user types.
//   - Selecting it calls onContinue('__all__') which sends the user to
//     DomainLoginForm regardless of user type.
//   - DomainLoginForm handles '__all__' by using clientAccount credentials
//     (POST /auth/login) and skipping the property access check, then
//     redirects to dashboard with no property scope (all properties shown).
//
// CLIENT ACCOUNT FLOW (specific property):
//   - isClientAccount=true + specific property selected → PropertySelectForm
//     handles navigation to /dashboard directly (no DomainLoginForm needed).
//
// REGULAR CLIENT FLOW (specific property):
//   - onContinue(propertyId) → parent shows DomainLoginForm with staff login.
// ─────────────────────────────────────────────────────────────────
export default function PropertySelectForm({ userData, isClientAccount, showMsg, hideMsg, onContinue, onBack }) {
  const auth = useAuth();
  const navigate = useNavigate();

  const [properties, setProperties]               = useState([]);
  const [loadingProps, setLoadingProps]           = useState(true);
  const [smoobuNotConnected, setSmoobuNotConnected] = useState(false);

  // Single selection — '__all__' means All Properties,
  // otherwise stores the Smoobu apartment ID coerced to STRING, or null
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

        // /api/properties returns { apartments: [...] }
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

  // ── Continue ──────────────────────────────────────────────────────
  // '__all__' selected (any user type):
  //   → always passes '__all__' to parent via onContinue so DomainLoginForm
  //     is shown next. DomainLoginForm will use clientAccount credentials
  //     and skip the property access check.
  //
  // Specific property + isClientAccount=true:
  //   → handles navigation to /dashboard internally (already authenticated).
  //
  // Specific property + regular user:
  //   → passes propertyId to parent (index.jsx) which shows DomainLoginForm
  //     for staff login with property access check.
  const handleContinue = () => {
    if (!selectedId) return;

    // ── "All Properties" — always go through DomainLoginForm ─────────
    if (selectedId === '__all__') {
      onContinue('__all__');
      return;
    }

    // ── Specific property + clientAccount — direct to dashboard ──────
    if (isClientAccount) {
      const prop = properties.find((p) => String(p.id) === selectedId);
      sessionStorage.setItem('hp_selected_property_id',   selectedId);
      sessionStorage.setItem('hp_selected_property_name', prop?.name || '');
      showMsg('Redirecting…', 'success');
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
      return;
    }

    // ── Specific property + regular user — go to DomainLoginForm ─────
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
          <>
            {/* ── All Properties option (always shown) ─────────────────────────
                Always rendered at the top for all user types.
                Selecting this sends the user to DomainLoginForm regardless
                of user type — credentials required before dashboard access.
            ── */}
            <PropertyCard
              key="__all__"
              label="All Properties"
              sublabel="View data across all your properties"
              isSelected={selectedId === '__all__'}
              onClick={() => setSelectedId('__all__')}
              isAllOption
            />
            {properties.map((prop) => (
              <PropertyCard
                key={prop.id}
                label={prop.name}
                // Compare as strings — Smoobu returns id as number, selectedId stored as string
                isSelected={String(selectedId) === String(prop.id)}
                onClick={() => setSelectedId(String(prop.id))}
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
// isAllOption: renders a slightly distinct style for the "All Properties" entry
// ─────────────────────────────────────────────────────────────────
function PropertyCard({ label, sublabel, isSelected, onClick, isAllOption }) {
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
        marginBottom:  isAllOption ? '12px' : '8px',
        borderRadius:  '12px',
        border:        `2px solid ${isSelected ? '#26a676' : isAllOption ? '#b8d4c4' : '#e3ede8'}`,
        background:    isSelected ? '#eaf8f1' : isAllOption ? '#f2faf6' : '#f8fbf9',
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