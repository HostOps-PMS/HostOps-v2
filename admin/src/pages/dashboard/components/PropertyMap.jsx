// components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// OpenStreetMap iframe + pin overlay + side legend.
//
// Business-account dropdown is populated by a DIRECT fetch to
// /api/accounts so it appears immediately, without waiting for the
// slow /api/dashboard-overview Smoobu aggregation.
//
// mapLocations (from overview) overlays Smoobu apartment coordinates
// on top of the DB accounts — used for the map pins.
//
// Props:
//   mapLocations : [{ apartmentId, apartmentName, propertyName, clientId,
//                     clientName, street, zip, city, country,
//                     latitude, longitude, type }]  — from overview, may be null
//   loading      : boolean  — true while overview is still fetching
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect } from 'react';

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

// Pad a [min,max] range so pins aren't glued to the map edges
function padded(min, max, ratio = 0.15) {
  if (min === max) {
    const d = 0.05;
    return [min - d, max + d];
  }
  const pad = (max - min) * ratio;
  return [min - pad, max + pad];
}

// ── Fetch accounts directly for the dropdown ──────────────────────
function useClientAccounts() {
  const [clients, setClients]   = useState([]);   // [{ id, name, properties[] }]
  const [acctLoading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = sessionStorage.getItem('hp_access_token') ?? '';
        const res = await fetch('/api/accounts', {
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${token}`,
            'x-api-key':    import.meta.env.VITE_API_KEY ?? '',
          },
          credentials: 'include',
        });

        if (!res.ok) throw new Error(`accounts ${res.status}`);
        const data = await res.json();

        // data = { users: [...], staffs: [...] }
        // Only business accounts (role: 'client') go in the dropdown.
        const users = Array.isArray(data.users) ? data.users : [];
        const mapped = users
          .filter((u) => u.role === 'client' || !u.role)
          .map((u) => ({
            id:         String(u._id || u.id),
            name:       u.businessName || u.firstName || u.email || 'Unnamed',
            properties: Array.isArray(u.properties) ? u.properties : [],
          }));

        if (!cancelled) setClients(mapped);
      } catch (err) {
        console.warn('[PropertyMap] accounts fetch failed:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { clients, acctLoading };
}

export default function PropertyMap({ mapLocations, loading }) {
  const [selected, setSelected] = useState('all'); // clientId or 'all'

  // Accounts from /api/accounts — populates the dropdown immediately
  const { clients, acctLoading } = useClientAccounts();

  // Smoobu locations from overview — used only for pin coordinates
  const smoobuLocs = Array.isArray(mapLocations) ? mapLocations : [];

  // Build the full location list:
  //   - Start from every DB property (ensures all accounts show in legend)
  //   - Overlay Smoobu lat/lng where available
  const locations = useMemo(() => {
    const result = [];

    clients.forEach((client, ci) => {
      if (client.properties.length === 0) {
        // Business account with no properties — still show in legend
        result.push({
          apartmentId:   `db:${client.id}`,
          apartmentName: '(no properties)',
          propertyName:  '(no properties)',
          clientId:      client.id,
          clientName:    client.name,
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
        });
      } else {
        client.properties.forEach((prop, pi) => {
          // Try to find a matching Smoobu location for coordinates
          const smoobu = smoobuLocs.find(
            (s) => s.clientId === client.id &&
                   (s.propertyName || '').toLowerCase() ===
                   (prop.propertyName || '').toLowerCase()
          );
          result.push({
            apartmentId:   smoobu?.apartmentId ?? `db:${client.id}:${pi}`,
            apartmentName: smoobu?.apartmentName || prop.propertyName || 'Property',
            propertyName:  prop.propertyName || 'Property',
            clientId:      client.id,
            clientName:    client.name,
            street:    smoobu?.street   || '',
            zip:       smoobu?.zip      || '',
            city:      smoobu?.city     || '',
            country:   smoobu?.country  || '',
            latitude:  smoobu?.latitude  ?? null,
            longitude: smoobu?.longitude ?? null,
          });
        });
      }
    });

    // Also include any Smoobu apartments that didn't match a DB client
    smoobuLocs.forEach((s) => {
      const alreadyIn = result.some(
        (r) => r.clientId === s.clientId &&
               (r.propertyName || '').toLowerCase() ===
               (s.propertyName || '').toLowerCase()
      );
      if (!alreadyIn) result.push(s);
    });

    return result;
  }, [clients, smoobuLocs]);

  // Unique client list for the dropdown (from DB accounts, not Smoobu)
  const dropdownClients = useMemo(() => {
    const seen = new Set();
    return clients.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [clients]);

  // Filter by selected business account
  const filtered = useMemo(() => (
    selected === 'all'
      ? locations
      : locations.filter((l) => l.clientId === selected)
  ), [locations, selected]);

  // Only properties with valid coordinates can be pinned
  const plottable = useMemo(() => filtered.filter(
    (l) => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  ), [filtered]);

  // Auto-fit bounding box around the plottable set
  const bbox = useMemo(() => {
    if (plottable.length === 0) {
      return { west: -20, south: -10, east: 60, north: 60 };
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

  const isDropdownLoading = acctLoading;
  const isMapLoading      = loading;

  return (
    <div className="db-table-card" style={{ flexShrink: 0, overflow: 'hidden' }}>
      {/* Header + dropdown */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 className="db-table-card__title">Property Map</h2>
          <p style={{ fontSize: '.74rem', color: 'var(--color-muted)', marginTop: 2 }}>
            {isMapLoading
              ? 'Loading coordinates…'
              : `${plottable.length} of ${filtered.length} mapped`}
          </p>
        </div>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isDropdownLoading}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: isDropdownLoading ? 'var(--color-muted)' : 'var(--color-text)',
            fontWeight: 600,
            fontSize: '.78rem',
            fontFamily: 'var(--font-body)',
            cursor: isDropdownLoading ? 'not-allowed' : 'pointer',
            maxWidth: 220,
          }}
        >
          <option value="all">
            {isDropdownLoading
              ? 'Loading accounts…'
              : `All business accounts (${dropdownClients.length})`}
          </option>
          {dropdownClients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isMapLoading ? (
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
            {isDropdownLoading ? (
              <div style={{ fontSize: '.72rem', color: 'var(--color-muted)' }}>
                Loading properties…
              </div>
            ) : filtered.length === 0 ? (
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
                        {addr || (hasCoords ? '' : 'No address in Smoobu')}
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