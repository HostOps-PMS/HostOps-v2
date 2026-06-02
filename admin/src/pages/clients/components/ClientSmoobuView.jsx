import { useState, useEffect, useCallback } from 'react';
import { getClientSmoobuData } from '../services/clientsService';

// ── Currency config ───────────────────────────────────────────────
const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD',  rate: 1 },
  { code: 'PHP', symbol: '₱', label: 'PHP',  rate: 56 }, // approx fixed rate
];

// ── Helpers ──────────────────────────────────────────────────────
function fmtMoney(n, currency) {
  const c = CURRENCIES.find(x => x.code === currency) ?? CURRENCIES[0];
  const converted = Number(n || 0) * c.rate;
  return c.symbol + converted.toLocaleString('en-US', {
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

function currentYear() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
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

// ── Currency Toggle ──────────────────────────────────────────────
function CurrencyToggle({ currency, onChange }) {
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
      {CURRENCIES.map(c => (
        <button
          key={c.code}
          onClick={() => onChange(c.code)}
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            fontSize: '.75rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all .15s',
            background: currency === c.code ? 'var(--color-brand, #26a676)' : 'transparent',
            color: currency === c.code ? '#fff' : 'var(--color-muted, #6a8b7c)',
          }}
        >
          {c.symbol} {c.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
// Props:
//   client   — the business account (User object)
//   property — the Property object whose Smoobu data we're viewing
//   onClose  — callback to close this view
export default function ClientSmoobuView({ client, property, onClose }) {
  if (!client || !property) return null;

  const [dateRange, setDateRange] = useState(currentYear);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [currency,  setCurrency]  = useState('USD');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass both clientId and propertyId — the server needs the property
      // to look up the smoobuApiKey without exposing it to the frontend.
      const result = await getClientSmoobuData(client._id, property._id, dateRange);
      setData(result);
    } catch (err) {
      setError(err.message ?? 'Failed to load Smoobu data');
    } finally {
      setLoading(false);
    }
  }, [client._id, property._id, dateRange]);

  useEffect(() => { load(); }, [load]);

  const stats      = data?.stats      ?? {};
  const properties = data?.properties ?? [];
  const byChannel  = data?.byChannel  ?? {};

  // Limit to 10 recent bookings
  const bookings = (data?.bookings ?? [])
    .filter(b => b.type !== 'cancellation' && !b['is-blocked-booking'])
    .sort((a, b) => new Date(b['created-at'] || b.arrival) - new Date(a['created-at'] || a.arrival))
    .slice(0, 10);

  const totalChRev = Object.values(byChannel).reduce((s, c) => s + c.revenue, 0);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--color-primary-soft, #d4f0e4)',
              color: 'var(--color-primary, #26a676)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '.8125rem', flexShrink: 0,
            }}>
              {initials(client.firstName, client.lastName)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.9375rem', color: 'var(--color-text, #1a2e2a)' }}>
                {client.firstName} {client.lastName}
              </div>
              {/* Show which property we're viewing */}
              <div style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)' }}>
                {property.name} · Smoobu Dashboard
              </div>
            </div>
          </div>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Date range controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
                style={{
                  fontSize: '.8125rem', padding: '5px 10px',
                  border: '1px solid var(--color-border, #d4e8de)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  background: 'var(--color-surface, #fff)',
                  color: 'var(--color-text, #1a2e2a)',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
                style={{
                  fontSize: '.8125rem', padding: '5px 10px',
                  border: '1px solid var(--color-border, #d4e8de)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  background: 'var(--color-surface, #fff)',
                  color: 'var(--color-text, #1a2e2a)',
                }}
              />
            </div>
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>

          {/* Loading */}
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
              {/* Sub-properties (rooms/units) */}
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

              {/* Stat cards */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatCard
                  label="Total Revenue"
                  value={fmtMoney(stats.totalRevenue, currency)}
                  accent="var(--color-primary, #26a676)"
                />
                <StatCard
                  label="Bookings"
                  value={stats.totalBookings ?? 0}
                />
                <StatCard
                  label="Avg. Stay"
                  value={`${stats.avgNights ?? 0} nights`}
                />
                <StatCard
                  label="Occupancy"
                  value={`${stats.occupancyRate ?? 0}%`}
                />
              </div>

              {/* 2-col grid: properties + channels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Properties */}
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

                {/* Channel breakdown */}
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
                                  {fmtMoney(ch.revenue, currency)} · {ch.bookings} bk
                                </span>
                              </div>
                              <div style={{
                                height: 5, borderRadius: 3,
                                background: 'var(--color-border, #e5e9ec)', overflow: 'hidden',
                              }}>
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

              {/* ── Recent bookings ── */}
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
                  borderRadius: 'var(--radius-md, 10px) var(--radius-md, 10px) 0 0',
                  background: 'var(--color-surface, #fff)',
                }}>
                  <SectionTitle>Recent Bookings</SectionTitle>
                  <span style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)' }}>
                    {bookings.length} shown
                  </span>
                </div>
                {bookings.length === 0 ? (
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
                        {bookings.map((b, i) => {
                          const channel = b.channel?.name || 'Direct';
                          const color   = channelColor(channel);
                          const nights  = nightsBetween(b.arrival, b.departure);
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
                                  background: color + '18', color: color,
                                  fontWeight: 600, fontSize: '.75rem',
                                }}>
                                  {channel}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', whiteSpace: 'nowrap' }}>
                                {fmtDate(b.arrival)}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', whiteSpace: 'nowrap' }}>
                                {fmtDate(b.departure)}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', textAlign: 'center' }}>
                                {nights}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-primary, #26a676)', whiteSpace: 'nowrap' }}>
                                {fmtMoney(b.price, currency)}
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