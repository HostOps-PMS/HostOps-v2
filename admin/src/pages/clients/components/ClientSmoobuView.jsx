import { useState, useEffect, useCallback } from 'react';
import { getClientSmoobuData } from '../services/clientsService';

// ── Helpers ──────────────────────────────────────────────────────
function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
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

// ── Main component ───────────────────────────────────────────────
export default function ClientSmoobuView({ client, onClose }) {
  if (!client) return null;

  const [dateRange, setDateRange] = useState(currentYear);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getClientSmoobuData(client._id, dateRange);
      setData(result);
    } catch (err) {
      setError(err.message ?? 'Failed to load Smoobu data');
    } finally {
      setLoading(false);
    }
  }, [client._id, dateRange]);

  useEffect(() => { load(); }, [load]);

  const stats      = data?.stats      ?? {};
  const properties = data?.properties ?? [];
  const byChannel  = data?.byChannel  ?? {};
  const bookings   = (data?.bookings  ?? [])
    .filter(b => b.type !== 'cancellation' && !b['is-blocked-booking'])
    .sort((a, b) => new Date(b['created-at'] || b.arrival) - new Date(a['created-at'] || a.arrival))
    .slice(0, 20);

  const totalChRev = Object.values(byChannel).reduce((s, c) => s + c.revenue, 0);
  const totalChBk  = Object.values(byChannel).reduce((s, c) => s + c.bookings, 0);

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
              <div style={{ fontSize: '.75rem', color: 'var(--color-muted, #7a8c8e)' }}>
                Smoobu Dashboard
              </div>
            </div>
          </div>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Date range bar ── */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--color-border, #e5e9ec)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'var(--color-bg, #f4f7f5)',
        }}>
          <label style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>From</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            style={{
              border: '1px solid var(--color-border, #e5e9ec)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '5px 10px', fontSize: '.8125rem',
              background: 'var(--color-surface, #fff)',
              color: 'var(--color-text, #1a2e2a)',
            }}
          />
          <label style={{ fontSize: '.8125rem', color: 'var(--color-muted, #7a8c8e)', fontWeight: 500 }}>To</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            style={{
              border: '1px solid var(--color-border, #e5e9ec)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '5px 10px', fontSize: '.8125rem',
              background: 'var(--color-surface, #fff)',
              color: 'var(--color-text, #1a2e2a)',
            }}
          />
          <button
            className="db-btn db-btn--primary"
            onClick={load}
            disabled={loading}
            style={{ padding: '5px 14px', fontSize: '.8125rem' }}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="db-modal__body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm, 6px)', padding: '12px 16px',
              fontSize: '.875rem', fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Not connected */}
          {!loading && data?.smoobuNotConnected && (
            <div style={{
              background: 'var(--color-surface, #fff)',
              border: '1px solid var(--color-border, #e5e9ec)',
              borderRadius: 'var(--radius-md, 10px)',
              padding: '40px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔌</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No Smoobu Account Connected</div>
              <div style={{ fontSize: '.875rem', color: 'var(--color-muted, #7a8c8e)' }}>
                This client hasn't set a Smoobu API key yet.
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ flex: 1, height: 80, borderRadius: 'var(--radius-md, 10px)', background: 'var(--color-border, #e5e9ec)' }} className="db-skeleton" />
                ))}
              </div>
              <div style={{ height: 200, borderRadius: 'var(--radius-md, 10px)', background: 'var(--color-border, #e5e9ec)' }} className="db-skeleton" />
            </>
          )}

          {/* Data */}
          {!loading && data && !data.smoobuNotConnected && (
            <>
              {/* ── Stat cards ── */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatCard
                  label="Revenue"
                  value={fmtMoney(stats.revenue)}
                  sub={`${stats.nights ?? 0} nights booked`}
                  accent="var(--color-primary, #26a676)"
                />
                <StatCard
                  label="Bookings"
                  value={stats.bookings ?? 0}
                  sub={`${stats.nights ?? 0} total nights`}
                />
                <StatCard
                  label="Cancellations"
                  value={stats.cancellations ?? 0}
                  sub={stats.cancelledNights ? `${stats.cancelledNights} nights affected` : undefined}
                  accent={stats.cancellations > 0 ? '#e55a3a' : undefined}
                />
                <StatCard
                  label="Occupancy"
                  value={`${stats.occupancy ?? 0}%`}
                  sub={`${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`}
                />
              </div>

              {/* ── Properties + Channel breakdown ── */}
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
                                  {fmtMoney(ch.revenue)} · {ch.bookings} bk
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
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 20px 12px',
                  borderBottom: '1px solid var(--color-border, #e5e9ec)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border, #e5e9ec)' }}>
                          {['Guest', 'Property', 'Channel', 'Arrival', 'Departure', 'Nights', 'Revenue'].map(h => (
                            <th key={h} style={{
                              padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                              color: 'var(--color-muted, #7a8c8e)', fontSize: '.75rem',
                              textTransform: 'uppercase', letterSpacing: '.04em',
                              background: 'var(--color-bg, #f4f7f5)',
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
                            <tr key={b.id ?? i} style={{
                              borderBottom: '1px solid var(--color-border, #e5e9ec)',
                              transition: 'background .15s',
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg, #f4f7f5)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text, #1a2e2a)' }}>
                                {b['guest-name'] || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)' }}>
                                {b.apartment?.name || '—'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 99,
                                  background: color + '18', color: color,
                                  fontWeight: 600, fontSize: '.75rem',
                                }}>
                                  {channel}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)' }}>
                                {fmtDate(b.arrival)}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)' }}>
                                {fmtDate(b.departure)}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-muted, #7a8c8e)', textAlign: 'center' }}>
                                {nights}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-primary, #26a676)' }}>
                                {fmtMoney(b.price)}
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
