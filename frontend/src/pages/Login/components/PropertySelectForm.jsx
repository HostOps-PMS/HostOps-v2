import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'https://api.hostops.online';

// ─────────────────────────────────────────────────────────────────
// PropertySelectForm
//
// Shown after OTP verification (or directly after login for staff).
// Fetches the user's embedded properties from GET /auth/my-properties
// and lets them pick one before advancing to PinModal.
// Displays one card at a time with arrow navigation + dot scrubber.
// Clicking the card proceeds immediately — no Continue button.
//
// Props:
//   userData           {object}   - user object from authData (role, email, etc.)
//   isClientAccount    {boolean}  - true when a clientAccount session is active
//   showMsg            {fn}
//   hideMsg            {fn}
//   onPropertySelected {fn(id, name)} - called when user selects + confirms a property
//   onContinue         {fn(id)}       - legacy fallback (kept for safety)
//   onBack             {fn}
// ─────────────────────────────────────────────────────────────────
export default function PropertySelectForm({
  userData,
  isClientAccount = false,
  showMsg,
  hideMsg,
  onPropertySelected,
  onContinue,
  onBack,
}) {
  const auth = useAuth();

  const [properties,   setProperties]   = useState([]);
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [slideDir,     setSlideDir]     = useState(''); // 'left' | 'right' | ''

  // ── Fetch properties on mount ──────────────────────────────────
  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const res = await auth.fetchWithAuth(`${API_BASE}/auth/my-properties`);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showMsg(err.error || 'Failed to load properties. Please try again.');
          setLoading(false);
          return;
        }

        const data = await res.json();
        const list = data.properties || [];
        setProperties(list);

        // Auto-proceed if only one property
        if (list.length === 1) {
          proceedWithProp(list[0]);
        }
      } catch (err) {
        showMsg('Network error. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proceed to PIN screen with a given property ────────────────
  const proceedWithProp = (prop) => {
    if (submitting) return;
    setSubmitting(true);
    hideMsg();
    if (onPropertySelected) {
      onPropertySelected(prop._id, prop.propertyName);
    } else if (onContinue) {
      onContinue(prop._id);
    }
    // Note: do NOT setSubmitting(false) — parent unmounts this component
  };

  // ── Carousel navigation ────────────────────────────────────────
  const goTo = (idx) => {
    if (idx === activeIndex) return;
    setSlideDir(idx > activeIndex ? 'left' : 'right');
    setActiveIndex(idx);
  };
  const goPrev = () => goTo(activeIndex > 0 ? activeIndex - 1 : properties.length - 1);
  const goNext = () => goTo(activeIndex < properties.length - 1 ? activeIndex + 1 : 0);

  const activeProp = properties[activeIndex] || null;

  return (
    <>
      {/* ── Fixed header ── */}
      <div style={{ flexShrink: 0, marginBottom: '14px' }}>
        <h1 className="lp-h1">Select Property</h1>
        <p className="lp-sub" style={{ marginBottom: 0 }}>Choose the property you want to log into.</p>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', overflow: 'hidden' }}>

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>Loading properties…</span>
          </div>

        ) : properties.length === 0 ? (
          <div style={styles.emptyWrap}>
            <div style={styles.emptyIcon}>🏠</div>
            <p style={styles.emptyText}>No properties found for your account.</p>
            <p style={styles.emptySubText}>Please contact your administrator.</p>
          </div>

        ) : (
          <>
            {/* ── Carousel row: prev arrow + card + next arrow ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>

              {/* Prev arrow */}
              <button
                type="button"
                onClick={goPrev}
                disabled={submitting}
                className="carousel-arrow"
                aria-label="Previous property"
                style={{
                  flexShrink:     0,
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '50%',
                  border:         '1.5px solid #e3ede8',
                  background:     '#fff',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  cursor:         submitting ? 'not-allowed' : 'pointer',
                  fontSize:       '16px',
                  color:          '#2a4e3c',
                  padding:        0,
                  opacity:        submitting ? 0.4 : 1,
                }}
              >
                ‹
              </button>

              {/* Card */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeProp && (
                  <PropertyCard
                    key={activeProp._id}
                    prop={activeProp}
                    disabled={submitting}
                    slideDir={slideDir}
                    onClick={() => proceedWithProp(activeProp)}
                  />
                )}
              </div>

              {/* Next arrow */}
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="carousel-arrow"
                aria-label="Next property"
                style={{
                  flexShrink:     0,
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '50%',
                  border:         '1.5px solid #e3ede8',
                  background:     '#fff',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  cursor:         submitting ? 'not-allowed' : 'pointer',
                  fontSize:       '16px',
                  color:          '#2a4e3c',
                  padding:        0,
                  opacity:        submitting ? 0.4 : 1,
                }}
              >
                ›
              </button>
            </div>

            {/* ── Dot indicators ── */}
            {properties.length > 1 && (
              <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                {properties.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={submitting}
                    aria-label={`Property ${i + 1}`}
                    style={{
                      width:        i === activeIndex ? '22px' : '7px',
                      height:       '7px',
                      borderRadius: '4px',
                      border:       'none',
                      background:   i === activeIndex ? '#26a676' : '#c8ddd4',
                      padding:      0,
                      cursor:       submitting ? 'default' : 'pointer',
                      transition:   'width 0.28s cubic-bezier(0.22,1,0.36,1), background 0.2s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Back link ── */}
      <div style={{ flexShrink: 0, marginTop: '14px' }}>
        <button type="button" className="lp-link" onClick={onBack}>
          ← Back to sign in
        </button>
      </div>

      <style>{cardAnimations}</style>
    </>
  );
}

// ── PropertyCard ───────────────────────────────────────────────────
function PropertyCard({ prop, disabled, onClick, slideDir }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasPicture = prop.propertyPicture && !imgFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`prop-card prop-card--slide-${slideDir || 'in'}`}
      style={{
        display:      'block',
        width:        '100%',
        border:       'none',
        borderRadius: '22px',
        overflow:     'hidden',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        padding:      0,
        background:   'none',
        textAlign:    'left',
        outline:      'none',
        position:     'relative',
      }}
    >
      {/* ── Full card visual ── */}
      <div style={{
        position:     'relative',
        width:        '100%',
        aspectRatio:  '4 / 3',
        borderRadius: '22px',
        overflow:     'hidden',
        boxShadow:    '0 10px 40px rgba(0,0,0,0.22)',
      }}>

        {/* ── Photo or placeholder ── */}
        {hasPicture ? (
          <img
            src={prop.propertyPicture}
            alt={prop.propertyName}
            onError={() => setImgFailed(true)}
            className="prop-card__img"
            style={{
              position:  'absolute',
              inset:     0,
              width:     '100%',
              height:    '100%',
              objectFit: 'cover',
              display:   'block',
            }}
          />
        ) : (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'linear-gradient(160deg, #0d3d28 0%, #26a676 60%, #1a5c40 100%)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <div style={{ position: 'absolute', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '-40px', right: '-40px' }} />
            <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: '30px', left: '-30px' }} />
            <span style={{ fontSize: '80px', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))' }}>🏡</span>
          </div>
        )}

        {/* ── Deep scrim ── */}
        <div style={{
          position:      'absolute',
          inset:         0,
          background:    'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 38%, rgba(0,0,0,0.0) 65%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* ── Hover shimmer ── */}
        <div className="prop-card__shimmer" style={{
          position:      'absolute',
          inset:         0,
          background:    'linear-gradient(160deg, rgba(38,166,118,0.25) 0%, transparent 50%)',
          opacity:       0,
          pointerEvents: 'none',
        }} />

        {/* ── "Tap to select" hint — top right ── */}
        <div className="prop-card__hint" style={{
          position:             'absolute',
          top:                  '14px',
          right:                '14px',
          background:           'rgba(255,255,255,0.13)',
          backdropFilter:       'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border:               '1px solid rgba(255,255,255,0.2)',
          borderRadius:         '20px',
          padding:              '5px 12px',
          fontSize:             '11px',
          fontWeight:           '600',
          color:                'rgba(255,255,255,0.9)',
          letterSpacing:        '0.2px',
          pointerEvents:        'none',
          opacity:              0,
        }}>
          Tap to select
        </div>

        {/* ── Bottom text block ── */}
        <div style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          right:         0,
          padding:       '28px 22px 22px',
          pointerEvents: 'none',
        }}>
          <p style={{
            margin:        0,
            fontSize:      '10px',
            fontWeight:    '700',
            color:         'rgba(255,255,255,0.5)',
            letterSpacing: '1.8px',
            textTransform: 'uppercase',
            marginBottom:  '5px',
          }}>
            Property
          </p>
          <p style={{
            margin:        0,
            fontSize:      '22px',
            fontWeight:    '800',
            color:         '#ffffff',
            lineHeight:    1.15,
            letterSpacing: '-0.4px',
            textShadow:    '0 2px 16px rgba(0,0,0,0.5)',
          }}>
            {prop.propertyName}
          </p>
        </div>

      </div>
    </button>
  );
}

// ── Static styles ──────────────────────────────────────────────────
const styles = {
  loadingWrap: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 0',
    gap:            '12px',
  },
  spinner: {
    width:        '28px',
    height:       '28px',
    border:       '3px solid #e3ede8',
    borderTop:    '3px solid #26a676',
    borderRadius: '50%',
    animation:    'spin 0.7s linear infinite',
  },
  loadingText: {
    fontSize: '13px',
    color:    '#9ab8a9',
  },
  emptyWrap: {
    textAlign: 'center',
    padding:   '32px 0',
  },
  emptyIcon: {
    fontSize:     '36px',
    marginBottom: '10px',
  },
  emptyText: {
    fontSize:   '14px',
    color:      '#2a4e3c',
    fontWeight: '600',
    margin:     '0 0 4px',
  },
  emptySubText: {
    fontSize: '13px',
    color:    '#9ab8a9',
    margin:   0,
  },
};

const cardAnimations = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(40px) scale(0.97); }
    to   { opacity: 1; transform: translateX(0)    scale(1);    }
  }
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(-40px) scale(0.97); }
    to   { opacity: 1; transform: translateX(0)     scale(1);    }
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes check-pop {
    0%   { transform: scale(0.3) rotate(-20deg); opacity: 0; }
    65%  { transform: scale(1.25) rotate(6deg);  opacity: 1; }
    100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
  }

  /* ── Card slide directions ── */
  .prop-card--slide-left  { animation: slide-in-left  0.32s cubic-bezier(0.22,1,0.36,1) both; }
  .prop-card--slide-right { animation: slide-in-right 0.32s cubic-bezier(0.22,1,0.36,1) both; }
  .prop-card--slide-in    { animation: slide-in       0.32s cubic-bezier(0.22,1,0.36,1) both; }

  /* ── Card hover ── */
  .prop-card {
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1);
  }
  .prop-card:not(:disabled):hover {
    transform: scale(1.015);
  }
  .prop-card:not(:disabled):hover .prop-card__img {
    transform: scale(1.06) !important;
  }
  .prop-card:not(:disabled):hover .prop-card__shimmer {
    opacity: 0.8 !important;
  }
  .prop-card:not(:disabled):hover .prop-card__hint {
    opacity: 1 !important;
    transition: opacity 0.2s ease;
  }
  .prop-card:not(:disabled):active {
    transform: scale(1.005);
    transition-duration: 0.08s;
  }
  .prop-card__img {
    transition: transform 0.5s cubic-bezier(0.22,1,0.36,1) !important;
  }
  .prop-card__shimmer {
    transition: opacity 0.28s ease;
  }
  .prop-card__hint {
    transition: opacity 0.2s ease;
  }

  /* ── Arrow buttons ── */
  .carousel-arrow {
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
  }
  .carousel-arrow:not(:disabled):hover {
    background:   #26a676 !important;
    border-color: #26a676 !important;
    color:        #fff !important;
    transform:    scale(1.08);
    box-shadow:   0 4px 14px rgba(38,166,118,0.35);
  }
  .carousel-arrow:not(:disabled):active {
    transform: scale(0.96);
  }
`;