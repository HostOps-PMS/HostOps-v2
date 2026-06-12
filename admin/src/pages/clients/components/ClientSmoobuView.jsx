import { useState, useEffect, useCallback, useRef } from 'react';
import { getClientSmoobuData, getExchangeRate, getApartmentPhotosBulk } from '../services/clientsService';

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
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYMD(first), to: toYMD(last) };
    }
    case 'yearly': {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      return { from: toYMD(first), to: toYMD(last) };
    }
    default:
      return null;
  }
}

function fmtShort(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

const PRESETS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
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
  'Airbnb': '#FF5A5F',
  'Booking.com': '#003580',
  'VRBO': '#1555C0',
  'Agoda': '#E0471F',
  'Direct': '#26a676',
  'Direct booking': '#26a676',
  'Facebook': '#1877F2',
  'WhatsApp': '#25D366',
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
    if (customFrom > customTo) { alert('"From" must be before "To".'); return; }
    setShowCustomPop(false);
    onCustomApply({ from: customFrom, to: customTo });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        background: 'var(--color-surface-2, #f0f5f2)',
        borderRadius: 12,
        padding: 3,
        gap: 2,
        width: '100%',
        boxSizing: 'border-box',
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
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
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
                <>
                  {/* Blurred backdrop — mobile only */}
                  <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1199,
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    background: 'rgba(0,0,0,0.18)',
                  }} onClick={() => setShowCustomPop(false)} />
                <div style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'var(--color-surface, #fff)',
                  border: '1.5px solid var(--color-border, #e3ede8)',
                  borderRadius: 18,
                  boxShadow: '0 16px 48px rgba(0,0,0,.18)',
                  padding: '20px',
                  zIndex: 1200,
                  width: 'min(320px, 90vw)',
                  boxSizing: 'border-box',
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
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Display active range label */}
      {dateRange.from && dateRange.to && activePreset !== 'custom' && (
        <span style={{
          fontSize: '.72rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500,
          textAlign: 'center', width: '100%', display: 'block',
        }}>
          {fmtShort(dateRange.from)} – {fmtShort(dateRange.to)}
        </span>
      )}
    </div>
  );
}

// ── Image carousel ───────────────────────────────────────────────
function ImageCarousel({ images, alt }) {
  const [idx, setIdx] = useState(0);

  if (!images?.length) {
    return (
      <div style={{
        width: '100%', aspectRatio: '16/9',
        background: 'var(--color-surface-2, #f0f7f4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary, #26a676)" strokeWidth="1"
          strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .4 }}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
    );
  }

  const prev = (e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); };

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#111' }}>
      <img
        key={idx}
        src={images[idx].url}
        alt={`${alt} ${idx + 1}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {images.length > 1 && (
        <>
          <button onClick={prev} style={{
            position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,.48)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', backdropFilter: 'blur(4px)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button onClick={next} style={{
            position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,.48)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', backdropFilter: 'blur(4px)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div style={{
            position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4, alignItems: 'center',
          }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{
                  width: i === idx ? 16 : 6, height: 6, borderRadius: 99,
                  background: i === idx ? '#fff' : 'rgba(255,255,255,.5)',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all .2s',
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'absolute', top: 7, right: 9,
            fontSize: '.65rem', fontWeight: 700,
            background: 'rgba(0,0,0,.48)', color: '#fff',
            borderRadius: 99, padding: '2px 7px',
            backdropFilter: 'blur(4px)',
          }}>
            {idx + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

// ── Expandable property list ────────────────────────────────────
function ExpandablePropertyList({ properties }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {properties.map((p, idx) => {
        const isOpen = expandedId === p.id;
        return (
          <div key={p.id} style={{
            borderRadius: 10,
            border: `1px solid ${isOpen ? 'var(--color-primary, #26a676)' : 'var(--color-border, #e5e9ec)'}`,
            background: isOpen ? '#f0faf5' : 'var(--color-surface-2, #f8faf9)',
            overflow: 'hidden',
            transition: 'border-color .15s',
          }}>
            {/* Row — always visible */}
            <div
              onClick={() => setExpandedId(isOpen ? null : p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: isOpen ? 'var(--color-primary, #26a676)' : 'var(--color-primary-soft, #d4f0e4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background .15s',
              }}>
                <span style={{ fontSize: '.6rem', fontWeight: 800, color: isOpen ? '#fff' : 'var(--color-primary, #26a676)' }}>
                  {idx + 1}
                </span>
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'var(--color-border, #e5e9ec)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--color-border, #e5e9ec)',
              }}>
                {p.picture ? (
                  <img src={p.picture} alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="var(--color-primary, #26a676)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '.75rem', fontWeight: 600,
                  color: 'var(--color-text, #1a2e2a)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.name}
                </div>
                {p.type && (
                  <div style={{ fontSize: '.65rem', color: 'var(--color-muted, #7a8c8e)', marginTop: 1 }}>
                    {p.type}
                  </div>
                )}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-muted, #7a8c8e)" strokeWidth="2.5" strokeLinecap="round"
                style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Expanded: image carousel */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--color-border, #e5e9ec)' }}>
                <ImageCarousel images={p.images} alt={p.name} />
                {p.type && (
                  <div style={{ padding: '8px 12px', fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>
                    {p.type}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function ClientSmoobuView({ client, property, onClose }) {
  if (!client || !property) return null;

  // Default preset is 'yearly'
  const [activePreset, setActivePreset] = useState('yearly');
  const [dateRange, setDateRange] = useState(() => getRangeForPreset('yearly'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currency, setCurrency] = useState('PHP');
  const [phpRate, setPhpRate] = useState(61.75);
  const [rateLabel, setRateLabel] = useState('est.');
  const [apartmentPhotos, setApartmentPhotos] = useState({});

  // Fetch live exchange rate once on mount
  useEffect(() => {
    getExchangeRate()
      .then(d => {
        if (d?.rates?.PHP) {
          setPhpRate(d.rates.PHP);
          setRateLabel('live');
        }
      })
      .catch(() => { }); // keep fallback silently
  }, []);

  // Data loader — same pattern as frontend useDashboardData
  const load = useCallback(async (fromOverride, toOverride) => {
    const from = fromOverride ?? dateRange.from;
    const to = toOverride ?? dateRange.to;

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

  // Fetch apartment photos whenever the properties list changes
  useEffect(() => {
    const props = data?.properties;
    if (!props?.length) return;
    const ids = props.map(p => String(p.id)).filter(Boolean);
    if (!ids.length) return;
    getApartmentPhotosBulk(ids)
      .then(res => setApartmentPhotos(res.photos ?? {}))
      .catch(() => {});
  }, [data?.properties]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const revenue = stats.revenue ?? 0;
  const bookings = stats.bookings ?? 0;
  const nights = stats.nights ?? 0;
  const occupancy = stats.occupancy ?? 0;
  const cancellations = stats.cancellations ?? 0;
  const cancelledNights = stats.cancelledNights ?? 0;

  const properties = (data?.properties ?? []).map(p => {
    const imgs = apartmentPhotos[String(p.id)] ?? [];
    return { ...p, picture: imgs[0]?.url ?? p.picture ?? null, images: imgs };
  });
  const byChannel = data?.byChannel ?? {};

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
        style={{ maxWidth: 1400, width: '98vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden' }}
      >
        {/* ── Header ── */}
        <div className="db-modal__head" style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border, #e5e9ec)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text, #1a2e2a)' }}>
              {client.businessName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client'}{' '}
              <span style={{ color: 'var(--color-primary, #26a676)' }}>Details</span>
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--color-muted, #7a8c8e)', marginTop: 3 }}>
              Performance overview and booking data.
            </div>
          </div>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="smoobu-datebar-wrap" style={{
          display: 'none',
          padding: '10px 16px',
          background: 'var(--color-surface, #fff)',
          borderBottom: '1px solid var(--color-border, #e5e9ec)',
          boxShadow: '0 2px 8px rgba(0,0,0,.06)',
          flexShrink: 0,
          zIndex: 10,
        }}>
          <DatePresetBar
            activePreset={activePreset}
            dateRange={dateRange}
            onPresetChange={handlePresetChange}
            onCustomApply={handleCustomApply}
          />
        </div>
        <div className="smoobu-body" style={{ flex: 1, display: 'flex', flexDirection: 'row-reverse', minHeight: 0, overflow: 'auto', flexWrap: 'wrap-reverse' }}>

          {/* ── LEFT: main scrollable content ── */}
          <div className="smoobu-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--color-bg, #f6f8f7)' }}>

          {/* Date filter + Currency — sticky top */}
          <div className="smoobu-datebar" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            background: 'var(--color-surface, #fff)',
            borderRadius: 12, padding: '10px 16px',
            border: '1px solid var(--color-border, #e5e9ec)',
            boxShadow: '0 2px 8px rgba(0,0,0,.06)',
            flexShrink: 0,
          }}>
            <DatePresetBar
              activePreset={activePreset}
              dateRange={dateRange}
              onPresetChange={handlePresetChange}
              onCustomApply={handleCustomApply}
            />
          </div>

          {/* Loading skeletons */}
          {/* Loading skeletons — mirrors the real layout exactly */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Property header: icon + title block */}
              <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--color-border, #e5e9ec)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="db-skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div className="db-skeleton" style={{ height: 22, width: '40%', borderRadius: 4 }} />
                  <div className="db-skeleton" style={{ height: 13, width: '22%', borderRadius: 4 }} />
                </div>
              </div>

              {/* Image + 2×2 stat cards */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div className="db-skeleton" style={{ width: 240, height: 240, borderRadius: 'var(--radius-lg, 16px)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="db-skeleton" style={{ height: 88, borderRadius: 'var(--radius-md, 10px)' }} />
                  ))}
                </div>
              </div>

              {/* Two-column section: Properties + Channels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    background: 'var(--color-surface, #fff)',
                    border: '1px solid var(--color-border, #e5e9ec)',
                    borderRadius: 'var(--radius-md, 10px)',
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div className="db-skeleton" style={{ height: 11, width: '40%', borderRadius: 4 }} />
                    {[1, 2, 3].map(j => (
                      <div key={j} className="db-skeleton" style={{ height: 14, width: `${75 - j * 10}%`, borderRadius: 4 }} />
                    ))}
                  </div>
                ))}
              </div>

              {/* Bookings table card */}
              <div style={{
                background: 'var(--color-surface, #fff)',
                border: '1px solid var(--color-border, #e5e9ec)',
                borderRadius: 'var(--radius-md, 10px)',
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '14px 20px 12px',
                  borderBottom: '1px solid var(--color-border, #e5e9ec)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div className="db-skeleton" style={{ height: 11, width: 130, borderRadius: 4 }} />
                  <div className="db-skeleton" style={{ height: 11, width: 60, borderRadius: 4 }} />
                </div>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr 1fr 0.5fr 0.9fr',
                  gap: 8, padding: '8px 20px',
                  background: 'var(--color-bg, #f4f7f5)',
                  borderBottom: '1px solid var(--color-border, #e5e9ec)',
                }}>
                  {[90, 80, 70, 70, 80, 40, 70].map((w, i) => (
                    <div key={i} className="db-skeleton" style={{ height: 10, width: `${w}%`, borderRadius: 4 }} />
                  ))}
                </div>
                {/* Rows */}
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr 1fr 0.5fr 0.9fr',
                    gap: 8, padding: '12px 20px',
                    borderBottom: i < 5 ? '1px solid var(--color-border, #e5e9ec)' : 'none',
                    alignItems: 'center',
                  }}>
                    {[85, 70, 55, 65, 65, 30, 60].map((w, j) => (
                      <div key={j} className="db-skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 4 }} />
                    ))}
                  </div>
                ))}
              </div>

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

              {/* Properties card grid + Channels ranked list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ── Channels: ranked list with % badge ── */}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(byChannel)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .map(([name, ch], idx) => {
                          const pct = totalChRev ? Math.round((ch.revenue / totalChRev) * 100) : 0;
                          const color = channelColor(name);
                          const rankColors = ['#f59e0b', '#94a3b8', '#cd7c3a'];
                          const rankColor = rankColors[idx] ?? 'var(--color-border, #e5e9ec)';
                          return (
                            <div key={name} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px',
                              borderRadius: 10,
                              background: idx === 0 ? 'linear-gradient(90deg, #fefce8, #fff)' : 'var(--color-surface-2, #f8faf9)',
                              border: `1px solid ${idx === 0 ? '#fde68a' : 'var(--color-border, #e5e9ec)'}`,
                            }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: rankColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#fff' }}>
                                  {idx + 1}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                                <span style={{
                                  width: 9, height: 9, borderRadius: '50%',
                                  background: color, flexShrink: 0, display: 'inline-block',
                                }} />
                                <span style={{
                                  fontSize: '.875rem', fontWeight: 600,
                                  color: 'var(--color-text, #1a2e2a)',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                  {name}
                                </span>
                              </div>
                              <span style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', flexShrink: 0 }}>
                                {ch.bookings} bk
                              </span>
                              <span style={{
                                fontSize: '.875rem', fontWeight: 700,
                                color: 'var(--color-text, #1a2e2a)', flexShrink: 0, minWidth: 80, textAlign: 'right',
                              }}>
                                {money(ch.revenue)}
                              </span>
                              <span style={{
                                fontSize: '.72rem', fontWeight: 700,
                                color: color,
                                background: color + '18',
                                borderRadius: 99, padding: '3px 8px',
                                flexShrink: 0, minWidth: 38, textAlign: 'center',
                              }}>
                                {pct}%
                              </span>
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
                overflow: 'hidden',
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
                          const color = channelColor(channel);
                          const nts = nightsBetween(b.arrival, b.departure);
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
        </div>{/* end LEFT */}

          {/* ── RIGHT: fixed sidebar — no scroll ── */}
          <div className="smoobu-sidebar" style={{
            width: 'clamp(280px, 30%, 400px)', flexShrink: 0, alignSelf: 'flex-start',
            borderLeft: '1px solid var(--color-border, #e5e9ec)',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            background: '#fafaf8',
            padding: '16px 14px',
            gap: 12,
            minHeight: '100%',
            boxSizing: 'border-box',
            justifyContent: 'flex-start',
          }}>

            {/* ── Property identity block ── */}
            <div style={{
              background: 'linear-gradient(135deg, #1a3d2e 0%, #26a676 100%)',
              borderRadius: 16,
              overflow: 'hidden',
              flexShrink: 0,
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(255,255,255,.15)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(255,255,255,.25)',
                }}>
                  {property.propertyPicture ? (
                    <img src={property.propertyPicture} alt={property.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(255,255,255,.9)" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '1rem', fontWeight: 800,
                    color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {property.propertyName || property.name || 'Property'}
                  </div>
                  <div style={{
                    fontSize: '.6rem', fontWeight: 700,
                    color: 'rgba(255,255,255,.65)',
                    textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 3,
                  }}>
                    Performance Dashboard
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.15)', borderRadius: 99 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                    Total Revenue
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {money(revenue)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                    Occupancy
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {occupancy}%
                  </div>
                </div>
              </div>
            </div>

            {/* ── Stat grid: 2×2 ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              flexShrink: 0,
            }}>
              {[
                { label: 'Bookings', value: bookings, accent: 'var(--color-text, #1a2e2a)', sub: `${nights} nights`, emoji: '🗓️' },
                { label: 'Cancelled', value: cancellations, accent: '#e55b5b', sub: `${cancelledNights} nights`, emoji: '🚫' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff',
                  border: '1px solid var(--color-border, #e5e9ec)',
                  borderRadius: 14,
                  padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '.6rem', fontWeight: 700,
                      color: 'var(--color-muted, #9ab8a9)',
                      textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: '.9rem' }}>{s.emoji}</span>
                  </div>
                  <div style={{
                    fontSize: '1.4rem', fontWeight: 900,
                    color: s.accent,
                    lineHeight: 1,
                  }}>
                    {s.value}
                  </div>
                  {s.sub && (
                    <div style={{ fontSize: '.65rem', color: 'var(--color-muted, #9ab8a9)' }}>
                      {s.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Properties list ── */}
            {data && !data.smoobuNotConnected && properties.length > 0 && (
              <div style={{
                background: '#fff',
                border: '1px solid var(--color-border, #e5e9ec)',
                borderRadius: 14,
                padding: '12px 14px',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--color-muted, #9ab8a9)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Properties
                  </div>
                  <span style={{
                    fontSize: '.6rem', fontWeight: 700,
                    color: 'var(--color-primary, #26a676)',
                    background: 'var(--color-primary-soft, #d4f0e4)',
                    borderRadius: 99, padding: '2px 7px',
                  }}>
                    {properties.length}
                  </span>
                </div>
                <ExpandablePropertyList properties={properties} />
              </div>
            )}

            {/* ── Currency toggle ── */}
            <div style={{
              background: '#fff',
              border: '1px solid var(--color-border, #e5e9ec)',
              borderRadius: 14,
              padding: '12px 14px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--color-muted, #9ab8a9)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Display Currency
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>
                  1 USD = ₱{phpRate.toFixed(2)}
                  <span style={{ opacity: .55, marginLeft: 4 }}>({rateLabel})</span>
                </span>
                <CurrencyToggle currency={currency} onChange={setCurrency} phpRate={phpRate} />
              </div>
            </div>

            {/* spacer fills remaining space with same bg */}
            <div style={{ flex: 1, minHeight: 0, background: '#fafaf8' }} />

          </div>{/* end RIGHT sidebar */}
        </div>{/* end body row */}
        </div>{/* end body wrapper */}

        {/* ── Mobile responsive styles ── */}
        <style>{`
          @media (max-width: 768px) {
            .smoobu-body {
              flex-direction: column-reverse !important;
              flex-wrap: nowrap !important;
              overflow-y: auto !important;
              overflow-x: hidden !important;
            }
            .smoobu-main {
              overflow-y: visible !important;
              min-width: 0 !important;
              width: 100% !important;
              padding-top: 0 !important;
            }
            .smoobu-sidebar {
              width: 100% !important;
              min-height: unset !important;
              border-left: none !important;
              border-bottom: 1px solid var(--color-border, #e5e9ec);
            }
            .smoobu-datebar-wrap {
              display: flex !important;
            }
            .smoobu-datebar {
              display: none !important;
            }
          }
        `}</style>

        {/* ── Footer ── */}
        <div className="db-modal__foot" style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border, #e5e9ec)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="db-btn db-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}