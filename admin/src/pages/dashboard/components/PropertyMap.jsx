// components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// Same visual style as before (OpenStreetMap iframe + pin overlay +
// side legend), but now driven by the live `mapLocations` array from
// /api/dashboard-overview, with a dropdown to filter by business account.
//
// The bounding box auto-fits to whatever properties are currently shown,
// so pins line up no matter where in the world the apartments are.
//
// Props:
//   mapLocations : [{ apartmentId, apartmentName, propertyName, clientId,
//                     clientName, street, zip, city, country,
//                     latitude, longitude, type }]
//   loading      : boolean
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

// Pad a [min,max] range so pins aren't glued to the map edges
function padded(min, max, ratio = 0.15) {
  if (min === max) {
    const d = 0.05; // single point — open a small window around it
    return [min - d, max + d];
  }
  const pad = (max - min) * ratio;
  return [min - pad, max + pad];
}

export default function PropertyMap({ mapLocations, loading }) {
  const [selected, setSelected] = useState('all'); // clientId or 'all'

  const locations = Array.isArray(mapLocations) ? mapLocations : [];
  const isDataReady = mapLocations !== null && mapLocations !== undefined;

  // Dropdown options: one per business account
  const clients = useMemo(() => {
    const map = new Map();
    locations.forEach((l) => {
      if (l.clientId && !map.has(l.clientId)) {
        map.set(l.clientId, l.clientName || 'Unnamed business');
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [locations]);

  // Filter by selected business account
  const filtered = useMemo(() => (
    selected === 'all' ? locations : locations.filter((l) => l.clientId === selected)
  ), [locations, selected]);

  // Only properties with valid coordinates can be pinned
  const plottable = useMemo(() => filtered.filter(
    (l) => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  ), [filtered]);

  // Auto-fit bounding box around the plottable set
  const bbox = useMemo(() => {
    if (plottable.length === 0) {
      return { west: -20, south: -10, east: 60, north: 60 }; // default view
    }
    const lats = plottable.map((l) => l.latitude);
    const lngs = plottable.map((l) => l.longitude);
    const [south, north] = padded(Math.min(...lats), Math.max(...lats));
    const [west, east]   = padded(Math.min(...lngs), Math.max(...lngs));
    return { west, south, east, north };
  }, [plottable]);

  const embedSrc =
    'https://www.openstreetmap.org/export/embed.html' +
    `?bbox=${bbox.west}%2C${bbox.south}%2C${bbox.east}%2C${bbox.north}` +
    '&layer=mapnik';

  return (
    <div className="db-table-card" style={{ flexShrink: 0, overflow: 'hidden' }}>
      {/* Header + dropdown */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 className="db-table-card__title">Property Map</h2>
          <p style={{ fontSize: '.74rem', color: 'var(--color-muted)', marginTop: 2 }}>
            {loading
              ? 'Loading property locations…'
              : !isDataReady
              ? 'Waiting for data…'
              : `${plottable.length} of ${filtered.length} mapped`}
          </p>
        </div>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontWeight: 600,
            fontSize: '.78rem',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            maxWidth: 220,
          }}
        >
          <option value="all">
            {!isDataReady
              ? 'Loading accounts…'
              : `All business accounts (${clients.length})`}
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 16 }}>
          <div className="db-skeleton" style={{ height: 325, borderRadius: 12 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', height: 325 }}>
          {/* Map iframe + pin overlay */}
          <div style={{ flex: 1, position: 'relative' }}>
            <iframe
              title="Property Map"
              src={embedSrc}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />

            {/* Property pins */}
            {plottable.map((p, i) => {
              const left = ((p.longitude - bbox.west) / (bbox.east - bbox.west)) * 100;
              const top  = ((bbox.north - p.latitude) / (bbox.north - bbox.south)) * 100;
              const addr = [p.street, p.city, p.country].filter(Boolean).join(', ');
              return (
                <div
                  key={p.apartmentId}
                  title={`${p.apartmentName || p.propertyName} — ${p.clientName || ''}${addr ? ' | ' + addr : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: COLORS[i % COLORS.length],
                    border: '2.5px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    zIndex: 999,
                  }}
                />
              );
            })}

            {/* Overlay when there are properties but none have coordinates */}
            {filtered.length > 0 && plottable.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 20,
              }}>
                <div style={{ color: 'var(--color-muted)', fontSize: '.82rem', maxWidth: 300 }}>
                  No map coordinates set for these properties yet. Add each apartment's
                  address in Smoobu to plot them here.
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{
            width: 170,
            flexShrink: 0,
            padding: '12px 14px',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
          }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: '.72rem', color: 'var(--color-muted)' }}>
                No properties to display.
              </div>
            ) : (
              filtered.map((p, i) => {
                const addr = [p.city, p.country].filter(Boolean).join(', ');
                const hasCoords = typeof p.latitude === 'number' && typeof p.longitude === 'number';
                return (
                  <div key={p.apartmentId} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: hasCoords ? COLORS[i % COLORS.length] : '#d1d5db',
                      flexShrink: 0, marginTop: 2,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.apartmentName || p.propertyName}
                      </div>
                      <div style={{ fontSize: '.68rem', color: 'var(--color-brand)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.clientName}
                      </div>
                      <div style={{ fontSize: '.68rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {addr || 'No address'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}