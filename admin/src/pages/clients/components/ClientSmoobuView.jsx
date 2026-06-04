import { useState, useEffect, useCallback, useRef } from 'react';
import { getClientSmoobuData, getExchangeRate } from '../services/clientsService';

// ── Date helpers (same logic as frontend DateFilterBar) ──────────
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRangeForPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'daily': {
      return { from: toYMD(today), to: toYMD(today) };
    }
    case 'weekly': {
      const day = today.getDay(); // 0 = Sun
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((day + 6) % 7)); // Monday
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: toYMD(mon), to: toYMD(sun) };
    }
    case 'monthly': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYMD(first), to: toYMD(last) };
    }
    case 'yearly': {
      const first = new Date(today.getFullYear(), 0, 1);
      const last  = new Date(today.getFullYear(), 11, 31);
      return { from: toYMD(first), to: toYMD(last) };
    }
    default:
      return null;
  }
}

function fmtShort(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

const PRESETS = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly' },
  { id: 'custom',  label: 'Custom' },
];

// ── Money / formatting helpers ───────────────────────────────────
function fmtMoney(n, currency, phpRate) {
  // The data from the backend is originally in PHP.
  // - If PHP, show raw value.
  // - If USD, convert from PHP -> USD by dividing by the USD->PHP rate.
  const converted = currency === 'PHP'
    ? Number(n || 0)
    : Number(n || 0) / (phpRate || 1);
    
  const symbol = currency === 'PHP' ? '₱' : '$';
  return symbol + converted.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function initials(firstName = '', lastName = '') {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
}

function nightsBetween(arrival, departure) {
  if (!arrival || !departure) return 0;
  return Math.max(0, Math.round(
    (new Date(departure) - new Date(arrival)) / (1000 * 60 * 60 * 24)
  ));
}

const CHANNEL_COLORS = {
  'Airbnb':           '#FF5A5F',
  'Booking.com':      '#003580',
  'VRBO':             '#1555C0',
  'Agoda':            '#E0471F',
  'Direct':           '#26a676',
  'Direct booking':   '#26a676',
  'Facebook':         '#1877F2',
  'WhatsApp':         '#25D366',
};

function channelColor(name) {
  return CHANNEL_COLORS[name] || '#8b9fa8';
}

// ── Sub-components ───────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--color-surface, #fff)',
      border: '1px solid var(--color-border, #e5e9ec)',
      borderRadius: 'var(--radius-md, 10px)',
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent || 'var(--color-text, #1a2e2a)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '.8125rem', fontWeight: 600, color: 'var(--color-muted, #7a8c8e)',
      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function CurrencyToggle({ currency, onChange, phpRate }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--color-surface-2, #f0f7f4)',
      border: '1px solid var(--color-border, #d4e8de)',
      borderRadius: 999,
      padding: '3px 4px',
    }}>
      {['USD', 'PHP'].map(code => {
        const symbol = code === 'PHP' ? '₱' : '$';
        return (
          <button
            key={code}
            onClick={() => onChange(code)}
            title={code === 'PHP' ? `1 USD = ₱${phpRate.toFixed(4)}` : ''}
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontSize: '.75rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all .15s',
              background: currency === code ? 'var(--color-brand, #26a676)' : 'transparent',
              color: currency === code ? '#fff' : 'var(--color-muted, #6a8b7c)',
            }}
          >
            {symbol} {code}
          </button>
        );
      })}
    </div>
  );
}

// ── Date Filter Pill Bar ─────────────────────────────────────────
function DatePresetBar({ activePreset, dateRange, onPresetChange, onCustomApply }) {
  const [showCustomPop, setShowCustomPop] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const popRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    function handler(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setShowCustomPop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handlePreset(preset) {
    if (preset === 'custom') {
      setShowCustomPop(true);
      onPresetChange('custom', null); // just mark active, don't load yet
      return;
    }
    setShowCustomPop(false);
    const range = getRangeForPreset(preset);
    if (!range) return;
    onPresetChange(preset, range);
  }

  function applyCustom() {
    if (!customFrom || !customTo) { alert('Please select both dates.'); return; }
    if (customFrom > customTo)    { alert('"From" must be before "To".'); return; }
    setShowCustomPop(false);
    onCustomApply({ from: customFrom, to: customTo });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex',
        background: 'var(--color-surface-2, #f0f5f2)',
        borderRadius: 12,
        padding: 3,
        gap: 2,
      }}>
        {PRESETS.map(({ id, label }) => {
          const on = activePreset === id;
          return (
            <div
              key={id}
              style={{ position: id === 'custom' ? 'relative' : undefined }}
              ref={id === 'custom' ? popRef : undefined}
            >
              <button
                onClick={() => handlePreset(id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 9,
                  fontSize: '.75rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  color: on ? 'var(--color-text, #0c1c14)' : 'var(--color-muted, #6a8b7c)',
                  background: on ? 'var(--color-surface, #fff)' : 'transparent',
                  border: on ? '1.5px solid var(--color-border, #d6ebe0)' : '1.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  boxShadow: on ? '0 1px 4px rgba(0,0,0,.07)' : 'none',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: id === 'custom' ? 5 : 0,
                }}
              >
                {id === 'custom' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                )}
                {label}
                {id === 'custom' && on && dateRange.from && dateRange.to && (
                  <span style={{
                    fontSize: '.68rem',
                    fontWeight: 600,
                    color: 'var(--color-primary, #26a676)',
                    marginLeft: 2,
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fmtShort(dateRange.from)} – {fmtShort(dateRange.to)}
                  </span>
                )}
              </button>

              {/* Custom date popover */}
              {id === 'custom' && showCustomPop && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: 'var(--color-surface, #fff)',
                  border: '1.5px solid var(--color-border, #e3ede8)',
                  borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(0,0,0,.12)',
                  padding: '16px',
                  zIndex: 1200,
                  minWidth: 280,
                }}>
                  <div style={{
                    fontSize: '.7rem', fontWeight: 700,
                    color: 'var(--color-muted, #9ab8a9)', letterSpacing: '.5px',
                    textTransform: 'uppercase', marginBottom: 10,
                  }}>
                    Custom date range
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <label style={{ fontSize: '.75rem', color: 'var(--color-muted, #6a8b7c)', fontWeight: 600 }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        border: '1.5px solid var(--color-border, #e3ede8)',
                        borderRadius: 9,
                        fontFamily: 'inherit',
                        fontSize: '.82rem',
                        color: 'var(--color-text, #0c1c14)',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    <label style={{ fontSize: '.75rem', color: 'var(--color-muted, #6a8b7c)', fontWeight: 600 }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        border: '1.5px solid var(--color-border, #e3ede8)',
                        borderRadius: 9,
                        fontFamily: 'inherit',
                        fontSize: '.82rem',
                        color: 'var(--color-text, #0c1c14)',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowCustomPop(false)}
                      style={{
                        flex: 1, padding: '9px', background: 'var(--color-surface-2, #f0f5f2)',
                        color: 'var(--color-text, #2a4e3c)', border: 'none', borderRadius: 9,
                        fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCustom}
                      style={{
                        flex: 1, padding: '9px', background: 'var(--color-primary, #26a676)',
                        color: '#fff', border: 'none', borderRadius: 9,
                        fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Display active range label */}
      <span style={{ fontSize: '.72rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>
        {dateRange.from && dateRange.to && activePreset !== 'custom' && (
          <>{fmtShort(dateRange.from)} – {fmtShort(dateRange.to)}</>
        )}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function ClientSmoobuView({ client, property, onClose }) {
  if (!client || !property) return null;

  // Default preset is 'yearly'
  const [activePreset, setActivePreset] = useState('yearly');
  const [dateRange, setDateRange] = useState(() => getRangeForPreset('yearly'));
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [currency,  setCurrency]  = useState('PHP');
  const [phpRate,   setPhpRate]   = useState(61.75);
  const [rateLabel, setRateLabel] = useState('est.');

  // Fetch live exchange rate once on mount
  useEffect(() => {
    getExchangeRate()
      .then(d => {
        if (d?.rates?.PHP) {
          setPhpRate(d.rates.PHP);
          setRateLabel('live');
        }
      })
      .catch(() => {}); // keep fallback silently
  }, []);

  // Data loader — same pattern as frontend useDashboardData
  const load = useCallback(async (fromOverride, toOverride) => {
    const from = fromOverride ?? dateRange.from;
    const to   = toOverride   ?? dateRange.to;

    setLoading(true);
    setError(null);
    try {
      const result = await getClientSmoobuData(client._id, property._id, { from, to });
      setData(result);
    } catch (err) {
      setError(err.message ?? 'Failed to load Smoobu data');
    } finally {
      setLoading(false);
    }
  }, [client._id, property._id, dateRange]);

  // Load on mount
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle preset change
  function handlePresetChange(preset, range) {
    setActivePreset(preset);
    if (range) {
      setDateRange(range);
      // Pass dates explicitly to avoid stale closure
      load(range.from, range.to);
    }
  }

  // Handle custom date apply
  function handleCustomApply(range) {
    setActivePreset('custom');
    setDateRange(range);
    load(range.from, range.to);
  }

  // Read stats directly from data.stats — same field names as the backend getDashboard returns
  const stats = data?.stats ?? {};
  const revenue        = stats.revenue        ?? 0;
  const bookings       = stats.bookings       ?? 0;
  const nights         = stats.nights         ?? 0;
  const occupancy      = stats.occupancy      ?? 0;
  const cancellations  = stats.cancellations  ?? 0;
  const cancelledNights = stats.cancelledNights ?? 0;

  const properties = data?.properties ?? [];
  const byChannel  = data?.byChannel  ?? {};

  const recentBookings = (data?.bookings ?? [])
    .filter(b => b.type !== 'cancellation' && !b['is-blocked-booking'])
    .sort((a, b) => new Date(b['created-at'] || b.arrival) - new Date(a['created-at'] || a.arrival))
    .slice(0, 10);

  const totalChRev = Object.values(byChannel).reduce((s, c) => s + c.revenue, 0);

  // Curried money formatter with live rate
  const money = (n) => fmtMoney(n, currency, phpRate);

  return (
    <div
      className="db-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1100 }}
    >
      <div
        className="db-modal"
        style={{ maxWidth: 860, width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ── */}
        <div className="db-modal__head">
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text, #1a2e2a)' }}>
            {client.businessName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client'}
          </div>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Date preset pills + currency controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <DatePresetBar
              activePreset={activePreset}
              dateRange={dateRange}
              onPresetChange={handlePresetChange}
              onCustomApply={handleCustomApply}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CurrencyToggle currency={currency} onChange={setCurrency} phpRate={phpRate} />
              <span style={{ fontSize: '.7rem', color: 'var(--color-muted, #7a8c8e)' }}>
                1 USD = ₱{phpRate.toFixed(2)} <span style={{ opacity: .6 }}>({rateLabel})</span>
              </span>
            </div>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} className="db-skeleton" style={{ height: 80, flex: 1, borderRadius: 'var(--radius-md, 10px)' }} />
                ))}
              </div>
              <div className="db-skeleton" style={{ height: 120, borderRadius: 'var(--radius-md, 10px)' }} />
              <div className="db-skeleton" style={{ height: 200, borderRadius: 'var(--radius-md, 10px)' }} />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-md, 10px)', padding: '16px 20px',
              fontSize: '.875rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Not connected */}
          {!loading && !error && data?.smoobuNotConnected && (
            <div style={{
              background: 'var(--color-surface-2, #f0f7f4)',
              border: '1px solid var(--color-border, #e5e9ec)',
              borderRadius: 'var(--radius-md, 10px)', padding: '32px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔌</div>
              <div style={{ fontWeight: 600, fontSize: '.9375rem', color: 'var(--color-text, #1a2e2a)', marginBottom: 6 }}>
                Smoobu Not Connected
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--color-muted, #7a8c8e)' }}>
                {data.message ?? 'This property has no Smoobu API key configured.'}
              </div>
            </div>
          )}

          {/* Dashboard data */}
          {!loading && !error && data && !data.smoobuNotConnected && (
            <>
              {/* Sub-properties */}
              {property.subProperties?.length > 0 && (
                <div style={{
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #e5e9ec)',
                  borderRadius: 'var(--radius-md, 10px)',
                  padding: '16px 20px',
                }}>
                  <SectionTitle>Rooms / Units ({property.subProperties.length})</SectionTitle>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {property.subProperties.map((sp) => (
                      <span key={sp._id ?? sp.smoobuId} style={{
                        padding: '4px 12px',
                        background: 'var(--color-surface-2, #f0f7f4)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 99,
                        fontSize: '.8125rem',
                        color: 'var(--color-text)',
                      }}>
                        {sp.name}
                        {sp.type && <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>· {sp.type}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Property Header & Stat cards */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: '1px solid var(--color-border, #e5e9ec)'
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px',
                    background: 'var(--color-primary-soft, #d4f0e4)',
                    color: 'var(--color-primary, #26a676)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text, #1a2e2a)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {property.propertyName || property.name || 'Property'}
                    </div>
                    <div style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500, marginTop: 4 }}>
                      Performance Dashboard
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {/* Left: Property Picture */}
                  <div style={{ 
                    width: 240, 
                    height: 240, 
                    flexShrink: 0,
                    borderRadius: 'var(--radius-lg, 16px)', 
                    overflow: 'hidden',
                    border: '1px solid var(--color-border, #e5e9ec)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                    background: 'var(--color-surface-2, #f0f7f4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4.5rem',
                    color: 'var(--color-primary, #26a676)',
                    fontWeight: 700
                  }}>
                    {property.propertyPicture ? (
                      <img 
                        src={property.propertyPicture} 
                        alt={property.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      (property.propertyName || property.name || '?').charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Right: Stat Cards (2x2 Symmetrical Grid) */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <StatCard
                      label="Total Revenue"
                      value={money(revenue)}
                      accent="var(--color-primary, #26a676)"
                    />
                    <StatCard
                      label="Bookings"
                      value={bookings}
                      sub={`${nights} nights total`}
                    />
                    <StatCard
                      label="Cancellations"
                      value={cancellations}
                      sub={`${cancelledNights} nights affected`}
                    />
                    <StatCard label="Occupancy" value={`${occupancy}%`} />
                  </div>
                </div>
              </div>

              {/* 2-col grid: properties + channels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #e5e9ec)',
                  borderRadius: 'var(--radius-md, 10px)',
                  padding: '16px 20px',
                }}>
                  <SectionTitle>Properties ({properties.length})</SectionTitle>
                  {properties.length === 0 ? (
                    <div style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', padding: '12px 0' }}>
                      No properties found.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {properties.map((p) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--color-primary, #26a676)', flexShrink: 0,
                          }} />
                          <span style={{ fontSize: '.875rem', color: 'var(--color-text, #1a2e2a)' }}>
                            {p.name}
                          </span>
                          {p.type && (
                            <span style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', marginLeft: 'auto' }}>
                              {p.type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #e5e9ec)',
                  borderRadius: 'var(--radius-md, 10px)',
                  padding: '16px 20px',
                }}>
                  <SectionTitle>Channels by Revenue</SectionTitle>
                  {Object.keys(byChannel).length === 0 ? (
                    <div style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', padding: '12px 0' }}>
                      No channel data.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(byChannel)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .map(([name, ch]) => {
                          const pct = totalChRev ? Math.round((ch.revenue / totalChRev) * 100) : 0;
                          const color = channelColor(name);
                          return (
                            <div key={name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '.8125rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--color-text, #1a2e2a)' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                  {name}
                                </span>
                                <span style={{ color: 'var(--color-muted, #7a8c8e)' }}>
                                  {money(ch.revenue)} · {ch.bookings} bk
                                </span>
                              </div>
                              <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border, #e5e9ec)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', width: `${pct}%`,
                                  background: color, borderRadius: 3,
                                  transition: 'width .4s ease',
                                }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent bookings table */}
              <div style={{
                background: 'var(--color-surface, #fff)',
                border: '1px solid var(--color-border, #e5e9ec)',
                borderRadius: 'var(--radius-md, 10px)',
                overflow: 'visible',
                flexShrink: 0,
              }}>
                <div style={{
                  padding: '14px 20px 12px',
                  borderBottom: '1px solid var(--color-border, #e5e9ec)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <SectionTitle>Recent Bookings</SectionTitle>
                  <span style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)' }}>
                    {recentBookings.length} shown
                  </span>
                </div>
                {recentBookings.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--color-muted, #7a8c8e)', fontSize: '.875rem' }}>
                    No confirmed bookings in this period.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: '0 0 var(--radius-md, 10px) var(--radius-md, 10px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
                      <thead>
                        <tr>
                          {['Guest', 'Property', 'Channel', 'Arrival', 'Departure', 'Nights', 'Revenue'].map(h => (
                            <th key={h} style={{
                              padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                              color: 'var(--color-muted, #7a8c8e)', fontSize: '.75rem',
                              textTransform: 'uppercase', letterSpacing: '.04em',
                              background: 'var(--color-bg, #f4f7f5)',
                              borderBottom: '1px solid var(--color-border, #e5e9ec)',
                              whiteSpace: 'nowrap',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b, i) => {
                          const channel = b.channel?.name || 'Direct';
                          const color   = channelColor(channel);
                          const nts     = nightsBetween(b.arrival, b.departure);
                          return (
                            <tr
                              key={b.id ?? i}
                              style={{ borderBottom: '1px solid var(--color-border, #e5e9ec)', transition: 'background .15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg, #f4f7f5)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text, #1a2e2a)', whiteSpace: 'nowrap' }}>
                                {b['guest-name'] || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', whiteSpace: 'nowrap' }}>
                                {b.apartment?.name || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 99,
                                  background: color + '18', color,
                                  fontWeight: 600, fontSize: '.75rem',
                                }}>
                                  {channel}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', whiteSpace: 'nowrap' }}>{fmtDate(b.arrival)}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', whiteSpace: 'nowrap' }}>{fmtDate(b.departure)}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', textAlign: 'center' }}>{nts}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-primary, #26a676)', whiteSpace: 'nowrap' }}>
                                {money(b.price)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="db-modal__foot">
          <button className="db-btn db-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}