// components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// OpenStreetMap iframe + pin overlay + side legend.
//
// Flow:
//   1. Dropdown 1 (Business Account) — populated from /api/accounts immediately.
//   2. Dropdown 2 (Property)         — shows DB properties of selected client.
//      • "All properties" = fetch ALL Smoobu sub-apartments for that client via
//        GET /api/accounts/:clientId/smoobu-apartments (no propertyIndex = all props)
//        OR use mapLocations from overview when "All accounts" is selected.
//      • Specific property = fetch Smoobu sub-apartments via
//        GET /api/accounts/:clientId/smoobu-apartments?propertyIndex=N
//        and display THOSE on the map instead.
//   3. Map + legend renders pins from whichever source is active.
//
// Props:
//   mapLocations : [{ apartmentId, apartmentName, propertyName, clientId,
//                     clientName, street, zip, city, country,
//                     latitude, longitude, type }]  — from overview, may be null
//   loading      : boolean  — true while overview is still fetching
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect, useCallback } from 'react';

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

// ── Helpers ───────────────────────────────────────────────────────

// Pad a [min,max] range so pins aren't glued to the map edges
function padded(min, max, ratio = 0.15) {
  if (min === max) {
    const d = 0.05;
    return [min - d, max + d];
  }
  const pad = (max - min) * ratio;
  return [min - pad, max + pad];
}

function authHeaders() {
  const token = sessionStorage.getItem('hp_access_token') ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-api-key':    import.meta.env.VITE_API_KEY ?? '',
  };
}

// ── Hook: fetch all client accounts for the top dropdown ─────────
function useClientAccounts() {
  const [clients, setClients]     = useState([]);   // [{ id, name, properties[] }]
  const [acctLoading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/accounts', {
          headers:     authHeaders(),
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
            // Each DB property entry — used to populate the property dropdown
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

// ── Hook: fetch Smoobu apartments for one client (one or all properties) ──
//
// When propertyIndex is a number → fetch sub-apartments for that specific
//   property only  (GET /api/accounts/:clientId/smoobu-apartments?propertyIndex=N)
//
// When propertyIndex is null AND clientId is set → fetch ALL sub-apartments
//   across every property of that client
//   (GET /api/accounts/:clientId/smoobu-apartments  — no propertyIndex param)
//
// When clientId is null → hook does nothing, returns empty list
//   (caller falls back to overview mapLocations)
//
// Returns:
//   { apartments, aptLoading, aptError }
//
// apartments: [{apartmentId, apartmentName, propertyName, clientId,
//               clientName, street, zip, city, country, latitude, longitude, ...}]
function useSmoobuApartments(clientId, propertyIndex) {
  const [apartments, setApartments] = useState([]);
  const [aptLoading, setLoading]    = useState(false);
  const [aptError, setError]        = useState(null);

  const fetch_ = useCallback(async () => {
    // Only skip when no client is selected at all
    if (!clientId) {
      setApartments([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // If propertyIndex is a number → scope to that property only
      // If null → fetch all properties for this client (no param)
      const qs = (propertyIndex !== null && propertyIndex !== undefined)
        ? `?propertyIndex=${propertyIndex}`
        : '';
      const url = `/api/accounts/${clientId}/smoobu-apartments${qs}`;
      const res = await fetch(url, {
        headers:     authHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `smoobu-apartments ${res.status}`);
      }
      const data = await res.json();
      setApartments(Array.isArray(data.allApartments) ? data.allApartments : []);
    } catch (err) {
      console.warn('[PropertyMap] smoobu-apartments fetch failed:', err.message);
      setError(err.message);
      setApartments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, propertyIndex]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { apartments, aptLoading, aptError, refetch: fetch_ };
}

// ── Main Component ────────────────────────────────────────────────
export default function PropertyMap({ mapLocations, loading }) {
  // Dropdown 1: selected business account
  const [selectedClient, setSelectedClient] = useState('all');
  // Dropdown 2: selected DB property index (null = "All properties" for that client)
  const [selectedPropIndex, setSelectedPropIndex] = useState(null);

  const { clients, acctLoading } = useClientAccounts();

  // The currently selected client object (for its properties[])
  const activeClient = useMemo(
    () => clients.find((c) => c.id === selectedClient) ?? null,
    [clients, selectedClient]
  );

  // When client changes, reset property selection
  function handleClientChange(clientId) {
    setSelectedClient(clientId);
    setSelectedPropIndex(null);
  }

  // When property changes
  function handlePropChange(raw) {
    if (raw === '' || raw === null || raw === 'all') {
      setSelectedPropIndex(null);
    } else {
      setSelectedPropIndex(Number(raw));
    }
  }

  // ── Smoobu apartments fetch ──────────────────────────────────────
  // Fetch whenever a specific client is selected (any property or all).
  // When "All accounts" is selected, we fall back to overview mapLocations.
  const smoobuClientId = selectedClient !== 'all' ? selectedClient : null;

  const { apartments: smoobuApts, aptLoading, aptError } =
    useSmoobuApartments(smoobuClientId, selectedPropIndex);

  // ── Smoobu locations from overview ─────────────────────────────
  const overviewLocs = Array.isArray(mapLocations) ? mapLocations : [];

  // ── Build the location list shown on the map ──────────────────
  //
  // MODE A: Specific client selected (any property or all)
  //   → use freshly fetched smoobuApts (live from that client's Smoobu API keys)
  //   → propertyIndex scopes to one property; null fetches all properties
  //
  // MODE B: "All business accounts"
  //   → original behavior: DB properties + overview mapLocations merged
  const locations = useMemo(() => {
    // MODE A: a specific client is selected — use live Smoobu data
    if (smoobuClientId) {
      // While loading, show DB stubs so the legend isn't empty
      if (aptLoading && smoobuApts.length === 0) {
        // Build stubs from DB properties for this client
        const client = clients.find((c) => c.id === smoobuClientId);
        if (!client) return [];
        const propsToShow = (selectedPropIndex !== null)
          ? [client.properties[selectedPropIndex]].filter(Boolean)
          : client.properties;
        return propsToShow.map((prop, i) => ({
          apartmentId:   `db:${smoobuClientId}:${i}`,
          apartmentName: prop?.propertyName || 'Property',
          propertyName:  prop?.propertyName || 'Property',
          clientId:      smoobuClientId,
          clientName:    client.name,
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
        }));
      }
      return smoobuApts;
    }

    // MODE B: Shared logic for "All accounts": build from DB + overlay overview coords
    const result = [];

    clients.forEach((client) => {
      if (client.properties.length === 0) {
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
          const smoobu = overviewLocs.find(
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

    // Also include any Smoobu overview apartments that didn't match a DB entry
    overviewLocs.forEach((s) => {
      const alreadyIn = result.some(
        (r) => r.clientId === s.clientId &&
               (r.propertyName || '').toLowerCase() ===
               (s.propertyName || '').toLowerCase()
      );
      if (!alreadyIn) result.push(s);
    });

    return result;
  }, [smoobuClientId, selectedPropIndex, smoobuApts, aptLoading, clients, overviewLocs]);

  // Only properties with valid coordinates can be pinned
  const plottable = useMemo(() => locations.filter(
    (l) => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  ), [locations]);

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

  // ── Dropdown 2: DB properties for the selected client ─────────
  const propertyOptions = useMemo(() => {
    if (!activeClient) return [];
    return activeClient.properties.map((p, i) => ({
      index: i,
      name:  p.propertyName || `Property ${i + 1}`,
    }));
  }, [activeClient]);

  // ── Loading states ─────────────────────────────────────────────
  const isDropdownLoading = acctLoading;
  const isMapLoading      = loading || aptLoading;

  // Status text under the "Property Map" title
  const statusText = useMemo(() => {
    if (aptLoading) return 'Fetching Smoobu sub-apartments…';
    if (aptError)   return `Smoobu error: ${aptError}`;
    if (isMapLoading) return 'Loading coordinates…';
    // Show context: is this live-fetched or overview data?
    const source = smoobuClientId
      ? '(live from Smoobu)'
      : '(from overview)';
    return `${plottable.length} of ${locations.length} mapped ${source}`;
  }, [aptLoading, aptError, isMapLoading, smoobuClientId,
      plottable.length, locations.length]);

  return (
    <div className="db-table-card" style={{ flexShrink: 0, overflow: 'hidden' }}>
      {/* ── Header + dropdowns ───────────────────────────────── */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 className="db-table-card__title">Property Map</h2>
          <p style={{ fontSize: '.74rem', color: 'var(--color-muted)', marginTop: 2 }}>
            {statusText}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Dropdown 1 — Business Account */}
          <select
            value={selectedClient}
            onChange={(e) => handleClientChange(e.target.value)}
            disabled={isDropdownLoading}
            style={dropdownStyle(isDropdownLoading)}
          >
            <option value="all">
              {isDropdownLoading
                ? 'Loading accounts…'
                : `All accounts (${clients.length})`}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Dropdown 2 — Property (only when a specific client is selected) */}
          {selectedClient !== 'all' && (
            <select
              value={selectedPropIndex ?? ''}
              onChange={(e) => handlePropChange(e.target.value)}
              disabled={isDropdownLoading || propertyOptions.length === 0}
              style={dropdownStyle(isDropdownLoading || propertyOptions.length === 0)}
            >
              <option value="">
                {propertyOptions.length === 0
                  ? 'No properties'
                  : `All properties (${propertyOptions.length})`}
              </option>
              {propertyOptions.map((p) => (
                <option key={p.index} value={p.index}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Map area ─────────────────────────────────────────── */}
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
              const label = p.apartmentName || p.propertyName;
              const client = p.clientName ? ` — ${p.clientName}` : '';
              const addrPart = addr ? ` | ${addr}` : '';
              return (
                <div
                  key={String(p.apartmentId)}
                  title={`${label}${client}${addrPart}`}
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
            {locations.length > 0 && plottable.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 20,
              }}>
                <div style={{ color: 'var(--color-muted)', fontSize: '.82rem', maxWidth: 300 }}>
                  {aptError
                    ? `Could not load Smoobu data: ${aptError}`
                    : 'No map coordinates set for these properties yet. Add each apartment\'s address in Smoobu to plot them here.'}
                </div>
              </div>
            )}
          </div>

          {/* ── Legend ─────────────────────────────────────── */}
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
            ) : locations.length === 0 ? (
              <div style={{ fontSize: '.72rem', color: 'var(--color-muted)' }}>
                No properties to display.
              </div>
            ) : (
              locations.map((p, i) => {
                const addr = [p.city, p.country].filter(Boolean).join(', ');
                const hasCoords = typeof p.latitude === 'number' && typeof p.longitude === 'number';
                // For live Smoobu mode, show apartment type if available
                const subtitle = p.type || addr || (hasCoords ? '' : 'No address in Smoobu');
                return (
                  <div key={String(p.apartmentId)} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: hasCoords ? COLORS[i % COLORS.length] : '#d1d5db',
                      flexShrink: 0, marginTop: 2,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '.72rem', fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.apartmentName || p.propertyName}
                      </div>
                      {/* In live-fetch mode show the DB property name as context */}
                      {p.propertyName && p.apartmentName !== p.propertyName && (
                        <div style={{
                          fontSize: '.67rem', color: 'var(--color-muted)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.propertyName}
                        </div>
                      )}
                      <div style={{
                        fontSize: '.68rem', color: 'var(--color-brand)', fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.clientName}
                      </div>
                      <div style={{
                        fontSize: '.68rem', color: 'var(--color-muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {subtitle}
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

// ── Shared dropdown style helper ──────────────────────────────────
function dropdownStyle(disabled) {
  return {
    padding: '6px 12px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: disabled ? 'var(--color-muted)' : 'var(--color-text)',
    fontWeight: 600,
    fontSize: '.78rem',
    fontFamily: 'var(--font-body)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    maxWidth: 220,
  };
}