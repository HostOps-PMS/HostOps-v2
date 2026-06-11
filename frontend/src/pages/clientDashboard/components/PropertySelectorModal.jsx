import React, { useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { authFetch } from '../../apiService';

// ── Design tokens (matching the rest of the dashboard) ────────────────────────
const T = {
  green:       '#26a676',
  greenDark:   '#1a7a57',
  greenLight:  '#e8f7f0',
  greenBorder: '#b8e8d0',
  text:        '#0c1c14',
  muted:       '#7a9e8c',
  faint:       '#b8d0c4',
  border:      '#e4ede8',
  bg:          '#f7faf8',
  white:       '#ffffff',
  fontDisplay: "'Sora', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
};

// Simple colour hash for property card accent
function propColor(name = '') {
  const palette = [
    '#26a676', '#1555C0', '#ec4899', '#8b5cf6',
    '#e07c2a', '#64748b', '#0891b2', '#16a34a',
  ];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return palette[idx];
}

// Property card
function PropertyCard({ property, selected, onClick }) {
  const [hov, setHov] = useState(false);
  const [imgError, setImgError] = useState(false);
  const color = propColor(property.name);

  // Build proxy URL from userId + propertyId stored on the property object.
  // Falls back to letter initial if either ID is missing or image fails to load.
  const proxyUrl = property.userId && property.propertyDbId
    ? `${import.meta.env.VITE_API_URL || ''}/api/image/property/${property.userId}/${property.propertyDbId}`
    : null;
  const showImage = proxyUrl && !imgError;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 14,
        border: `2px solid ${selected ? color : (hov ? color + '88' : T.border)}`,
        background: selected ? color + '12' : (hov ? color + '08' : T.white),
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'all .15s',
        boxShadow: selected ? `0 0 0 3px ${color}30` : (hov ? '0 2px 8px rgba(0,0,0,.06)' : 'none'),
      }}
    >
      {/* Property thumbnail — proxy image with letter-initial fallback */}
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: selected || hov ? color : color + '22',
        color: selected || hov ? '#fff' : color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 17,
        fontWeight: 800,
        fontFamily: T.fontDisplay,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'all .15s',
      }}>
        {showImage ? (
          <img
            src={proxyUrl}
            alt={property.name}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              borderRadius: 10,
            }}
          />
        ) : (
          (property.name || '?')[0].toUpperCase()
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.fontBody,
          fontWeight: 700,
          fontSize: 14,
          color: T.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 2,
        }}>
          {property.name}
        </div>
        {property.city || property.location ? (
          <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.muted }}>
            {[property.city, property.country].filter(Boolean).join(', ')}
          </div>
        ) : null}
      </div>

      {/* Check indicator */}
      {selected && (
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

// "All Properties" card
function AllPropertiesCard({ selected, count, onClick }) {
  const [hov, setHov] = useState(false);
  const color = T.green;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 14,
        border: `2px solid ${selected ? color : (hov ? color + '88' : T.border)}`,
        background: selected ? color + '12' : (hov ? color + '08' : T.white),
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'all .15s',
        boxShadow: selected ? `0 0 0 3px ${color}30` : (hov ? '0 2px 8px rgba(0,0,0,.06)' : 'none'),
        gridColumn: '1 / -1', // span full width
      }}
    >
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: selected || hov ? color : color + '22',
        color: selected || hov ? '#fff' : color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
        transition: 'all .15s',
      }}>
        🏘
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.fontBody, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 2 }}>
          All Properties
        </div>
        <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.muted }}>
          View combined data across all {count} propert{count === 1 ? 'y' : 'ies'}
        </div>
      </div>

      {selected && (
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * PropertySelectorModal
 *
 * Full-screen overlay shown after login when no property has been selected yet
 * for this session.  Also shown when the user taps "Change Property".
 *
 * Props:
 *   onSelect(id, name) — called when the user confirms a selection.
 *                        id === null means "All Properties".
 */
export default function PropertySelectorModal({ onSelect }) {
  const auth = useAuth();
  const [properties, setProperties]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [pendingId, setPendingId]     = useState(undefined); // undefined = not chosen yet
  const [confirming, setConfirming]   = useState(false);

  // The auth user object (from login response / localStorage) contains the
  // user's MongoDB _id and their properties array with MongoDB _ids.
  // We use these to build proxy URLs by matching Smoobu apartment id → DB _id.
  const authUser = (() => {
    try {
      const CANDIDATE_KEYS = ['hp_user', 'user', 'auth_user', 'currentUser', 'hostpilot_user'];
      for (const key of CANDIDATE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && (parsed._id || parsed.email)) return parsed;
        if (parsed?.user && (parsed.user._id || parsed.user.email)) return parsed.user;
      }
      return null;
    } catch { return null; }
  })();

  // Fetch the user's property list
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    authFetch('/api/properties', {}, auth)
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) throw new Error('Failed to load properties');
        const data = await res.json();
        if (!cancelled) {
          // Cross-reference each Smoobu apartment with the auth user's DB properties
          // to get the MongoDB _id needed to build the image proxy URL.
          // Matching strategy: propertyName (Smoobu "name") vs DB "propertyName".
          const dbProps = authUser?.properties || [];
          const apartments = (data.apartments || []).map(apt => {
            const match = dbProps.find(
              p => p.propertyName?.trim().toLowerCase() === apt.name?.trim().toLowerCase()
            );
            return {
              ...apt,
              propertyDbId: match?._id || null,
              userId:       authUser?._id || null,
            };
          });
          setProperties(apartments);
          // Default selection: null = All Properties
          setPendingId(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [auth]);

  function handleConfirm() {
    if (pendingId === undefined) return;
    setConfirming(true);

    const selectedName = pendingId === null
      ? ''
      : (properties.find((p) => String(p.id) === String(pendingId))?.name || '');

    // Small delay so the button gives visual feedback
    setTimeout(() => {
      onSelect(pendingId, selectedName);
      setConfirming(false);
    }, 180);
  }

  const canConfirm = pendingId !== undefined;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: 'rgba(8, 20, 14, 0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: T.white,
        borderRadius: 24,
        width: 560,
        maxWidth: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,.3), 0 0 0 1px rgba(0,0,0,.06)',
      }}>

        {/* Header */}
        <div style={{
          padding: '28px 28px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: T.greenLight,
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: T.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>
              🏠
            </div>
            <div>
              <div style={{
                fontFamily: T.fontDisplay,
                fontWeight: 800,
                fontSize: 18,
                color: T.text,
                lineHeight: 1.2,
              }}>
                Select a Property
              </div>
              <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.muted, marginTop: 2 }}>
                Your dashboard and inbox will be filtered to your selection
              </div>
            </div>
          </div>
        </div>

        {/* Body — property list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
        }}>
          {loading && (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              fontFamily: T.fontBody,
              color: T.muted,
              fontSize: 14,
            }}>
              <div style={{ marginBottom: 10, fontSize: 28 }}>⏳</div>
              Loading your properties…
            </div>
          )}

          {error && !loading && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              fontFamily: T.fontBody,
              color: '#e84545',
              fontSize: 13,
              lineHeight: 1.7,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
              Could not load properties.<br />
              <span style={{ color: T.muted, fontSize: 12 }}>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}>
              {/* All Properties option — always first, spans full width */}
              <AllPropertiesCard
                selected={pendingId === null}
                count={properties.length}
                onClick={() => setPendingId(null)}
              />

              {properties.map((prop) => (
                <PropertyCard
                  key={prop.id}
                  property={prop}
                  selected={String(pendingId) === String(prop.id)}
                  onClick={() => setPendingId(prop.id)}
                />
              ))}

              {properties.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '30px 0',
                  textAlign: 'center',
                  fontFamily: T.fontBody,
                  fontSize: 13,
                  color: T.faint,
                  lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
                  No properties found on your Smoobu account.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — confirm button */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.muted }}>
            {pendingId === null
              ? `Showing all ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`
              : pendingId !== undefined
                ? `Selected: ${properties.find((p) => String(p.id) === String(pendingId))?.name || ''}`
                : 'Choose a property above'}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!canConfirm || confirming}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: canConfirm && !confirming ? T.green : T.faint,
              color: '#fff',
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: 14,
              cursor: canConfirm && !confirming ? 'pointer' : 'default',
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexShrink: 0,
            }}
          >
            {confirming ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="30 30">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
                  </circle>
                </svg>
                Loading…
              </>
            ) : (
              <>
                View Dashboard
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}