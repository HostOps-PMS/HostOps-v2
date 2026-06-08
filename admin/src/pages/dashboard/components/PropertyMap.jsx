// components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// Leaflet.js map + real markers + side legend.
//
// Uses Leaflet loaded from CDN (no npm install needed) so markers
// are actual map objects that pan/zoom with the map — not absolutely-
// positioned overlays that drift away from the iframe.
//
// Flow:
//   1. Dropdown 1 (Business Account) — populated from /api/accounts.
//   2. Dropdown 2 (Property)         — shows DB properties of selected client.
//      • "All properties" = fetch ALL Smoobu sub-apartments for that client via
//        GET /api/accounts/:clientId/smoobu-apartments (no propertyIndex = all)
//        OR use mapLocations from overview when "All accounts" is selected.
//      • Specific property = GET /api/accounts/:clientId/smoobu-apartments?propertyIndex=N
//   3. Leaflet map renders markers from whichever source is active.
//
// Props:
//   mapLocations : [{ apartmentId, apartmentName, propertyName, clientId,
//                     clientName, street, zip, city, country,
//                     latitude, longitude, type }]  — from overview, may be null
//   loading      : boolean  — true while overview is still fetching
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

// ── Jitter helper ─────────────────────────────────────────────────
// When multiple apartments share the exact same lat/lng (common for
// units inside one building), Leaflet stacks them so only the top
// marker is clickable.  This function spreads duplicates in a small
// circle (~20 m radius) so every marker is individually visible.
function applyCoordJitter(points) {
  const seen = {};
  return points.map((p) => {
    if (p.latitude === null || p.longitude === null) return p;
    const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
    const count = seen[key] ?? 0;
    seen[key] = count + 1;
    if (count === 0) return p; // first occurrence — no jitter
    // Spread subsequent duplicates evenly around a ~0.00018° radius (~20 m)
    const angle = (count * (2 * Math.PI)) / 8; // up to 8 unique positions
    const r = 0.00018;
    return {
      ...p,
      latitude:  p.latitude  + r * Math.sin(angle),
      longitude: p.longitude + r * Math.cos(angle),
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function authHeaders() {
  const token = sessionStorage.getItem('hp_access_token') ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-api-key':    import.meta.env.VITE_API_KEY ?? '',
  };
}

// Normalise a coordinate value that may be a string or number.
// Returns a finite number or null.
function toCoord(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

// ── Leaflet loader ────────────────────────────────────────────────
// Injects the Leaflet CSS + JS from CDN once, resolves when ready.
let leafletPromise = null;
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }

    // CSS
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id  = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload  = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

// ── Hook: fetch all client accounts for the top dropdown ─────────
function useClientAccounts() {
  const [clients, setClients]     = useState([]);
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

// ── Hook: fetch Smoobu apartments for one client ──────────────────
function useSmoobuApartments(clientId, propertyIndex) {
  const [apartments, setApartments] = useState([]);
  const [aptLoading, setLoading]    = useState(false);
  const [aptError, setError]        = useState(null);

  const fetch_ = useCallback(async () => {
    if (!clientId) {
      setApartments([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
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
      // Normalise coords to numbers here so downstream never sees strings
      const apts = (Array.isArray(data.allApartments) ? data.allApartments : []).map((a) => ({
        ...a,
        latitude:  toCoord(a.latitude),
        longitude: toCoord(a.longitude),
      }));
      setApartments(apts);
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

// ── Leaflet map hook ──────────────────────────────────────────────
// Initialises the map into `containerRef` every time the ref's DOM node
// is (re)attached, then updates markers whenever `plottable` changes.
//
// Key design: the map is tied to the DOM node. When the parent switches
// between the skeleton and the real map div (isMapLoading toggle), the
// old DOM node is removed. The cleanup in the effect destroys the L.Map.
// Next render mounts a fresh node, this effect fires again, and a new
// map is created. We must NOT gate on "if (mapRef.current) return".
function useLeafletMap(containerRef, plottable) {
  const mapRef     = useRef(null);  // L.Map instance
  const markersRef = useRef([]);    // current L.Marker[]
  const [leafletReady, setLeafletReady] = useState(!!window.L);

  // Load Leaflet once
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    loadLeaflet()
      .then(() => setLeafletReady(true))
      .catch((err) => console.error('[PropertyMap] Leaflet load failed:', err));
  }, []);

  // Init (or re-init) map whenever the container node becomes available.
  // containerRef.current is listed as a dep so React re-runs this whenever
  // the DOM node is replaced (e.g. loading skeleton → real map).
  useEffect(() => {
    if (!leafletReady || !containerRef.current) return;

    // Destroy any stale map before creating a new one
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current    = null;
      markersRef.current = [];
    }

    const L   = window.L;
    const map = L.map(containerRef.current, {
      center:          [14.5, 121.0], // default: Philippines
      zoom:            6,
      zoomControl:     true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Let the container fully paint before asking Leaflet to measure it
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current    = null;
      markersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady, containerRef.current]); // re-run when DOM node changes

  // Update markers whenever plottable list changes
  useEffect(() => {
    const L   = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (plottable.length === 0) return;

    // Apply jitter so duplicate-coordinate markers (units in same building)
    // are all visible instead of stacked on top of each other.
    const jittered = applyCoordJitter(plottable);

    const bounds = [];

    jittered.forEach((p, i) => {
      const color  = COLORS[i % COLORS.length];
      const label  = p.apartmentName || p.propertyName || '';
      const addr   = [p.street, p.city, p.country].filter(Boolean).join(', ');
      const client = p.clientName || '';

      // Coloured circle div-icon — moves correctly with pan/zoom
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2.5px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,0.35);
          cursor:pointer;
        "></div>`,
        iconSize:   [14, 14],
        iconAnchor: [7,  7],
        popupAnchor:[0, -10],
      });

      const marker = L.marker([p.latitude, p.longitude], { icon });

      const popupHtml = `
        <div style="font-size:12px;line-height:1.5;min-width:140px;">
          <div style="font-weight:700;margin-bottom:2px;">${label}</div>
          ${client ? `<div style="color:#1a9e6e;font-weight:600;">${client}</div>` : ''}
          ${addr    ? `<div style="color:#6b7280;">${addr}</div>` : ''}
          ${p.type  ? `<div style="color:#6b7280;">${p.type}</div>` : ''}
        </div>`;
      marker.bindPopup(popupHtml);
      marker.addTo(map);

      markersRef.current.push(marker);
      bounds.push([p.latitude, p.longitude]);
    });

    // Fit viewport to show all markers
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [plottable]);

  return { leafletReady };
}

// ── Main Component ────────────────────────────────────────────────
export default function PropertyMap({ mapLocations, loading }) {
  const [selectedClient,    setSelectedClient]    = useState('all');
  const [selectedPropIndex, setSelectedPropIndex] = useState(null);

  const { clients, acctLoading } = useClientAccounts();

  const activeClient = useMemo(
    () => clients.find((c) => c.id === selectedClient) ?? null,
    [clients, selectedClient]
  );

  function handleClientChange(clientId) {
    setSelectedClient(clientId);
    setSelectedPropIndex(null);
  }

  function handlePropChange(raw) {
    setSelectedPropIndex(raw === '' || raw === null || raw === 'all' ? null : Number(raw));
  }

  // Fetch from Smoobu whenever a specific client is selected
  const smoobuClientId = selectedClient !== 'all' ? selectedClient : null;

  const { apartments: smoobuApts, aptLoading, aptError } =
    useSmoobuApartments(smoobuClientId, selectedPropIndex);

  // Normalise overview coords too (may also be strings)
  const overviewLocs = useMemo(() =>
    (Array.isArray(mapLocations) ? mapLocations : []).map((l) => ({
      ...l,
      latitude:  toCoord(l.latitude),
      longitude: toCoord(l.longitude),
    })),
  [mapLocations]);

  // ── Build full location list (for legend) ─────────────────────
  const locations = useMemo(() => {
    if (smoobuClientId) {
      if (aptLoading && smoobuApts.length === 0) {
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
          clientName:    activeClient?.name || '',
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
        }));
      }
      return smoobuApts;
    }

    // All accounts — merge DB + overview
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
    overviewLocs.forEach((s) => {
      const alreadyIn = result.some(
        (r) => r.clientId === s.clientId &&
               (r.propertyName || '').toLowerCase() ===
               (s.propertyName || '').toLowerCase()
      );
      if (!alreadyIn) result.push(s);
    });
    return result;
  }, [smoobuClientId, selectedPropIndex, smoobuApts, aptLoading,
      clients, overviewLocs, activeClient]);

  // Only entries with valid numeric coords go on the map
  const plottable = useMemo(() =>
    locations.filter(
      (l) => l.latitude !== null && l.longitude !== null &&
             Number.isFinite(l.latitude) && Number.isFinite(l.longitude)
    ),
  [locations]);

  // ── Leaflet map ────────────────────────────────────────────────
  const mapContainerRef = useRef(null);
  useLeafletMap(mapContainerRef, plottable);

  // ── Dropdown options ───────────────────────────────────────────
  const propertyOptions = useMemo(() => {
    if (!activeClient) return [];
    return activeClient.properties.map((p, i) => ({
      index: i,
      name:  p.propertyName || `Property ${i + 1}`,
    }));
  }, [activeClient]);

  const isDropdownLoading = acctLoading;
  const isMapLoading      = loading || aptLoading;

  const statusText = useMemo(() => {
    if (aptLoading)   return 'Fetching Smoobu sub-apartments…';
    if (aptError)     return `Smoobu error: ${aptError}`;
    if (isMapLoading) return 'Loading coordinates…';
    const source = smoobuClientId ? '(live from Smoobu)' : '(from overview)';
    return `${plottable.length} of ${locations.length} mapped ${source}`;
  }, [aptLoading, aptError, isMapLoading, smoobuClientId,
      plottable.length, locations.length]);

  return (
    <div className="db-table-card" style={{ flexShrink: 0, overflow: 'visible' }}>

      {/* ── Header + dropdowns ── */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 className="db-table-card__title">Property Map</h2>
          <p style={{ fontSize: '.74rem', color: 'var(--color-muted)', marginTop: 2 }}>
            {statusText}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedClient}
            onChange={(e) => handleClientChange(e.target.value)}
            disabled={isDropdownLoading}
            style={dropdownStyle(isDropdownLoading)}
          >
            <option value="all">
              {isDropdownLoading ? 'Loading accounts…' : `All accounts (${clients.length})`}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

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

      {/* ── Map + legend ── */}
      {isMapLoading ? (
        <div style={{ padding: 16 }}>
          <div className="db-skeleton" style={{ height: 325, borderRadius: 12 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', height: 325, overflow: 'hidden', borderRadius: '0 0 var(--radius-card, 12px) var(--radius-card, 12px)' }}>

          {/* Leaflet map container */}
          <div
            ref={mapContainerRef}
            style={{ flex: 1, minWidth: 0, zIndex: 0, overflow: 'hidden' }}
          >
            {/* Overlay shown when no coords are available */}
            {locations.length > 0 && plottable.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 20,
              }}>
                <div style={{ color: 'var(--color-muted)', fontSize: '.82rem', maxWidth: 300 }}>
                  {aptError
                    ? `Could not load Smoobu data: ${aptError}`
                    : "No map coordinates set for these properties yet. Add each apartment's address in Smoobu to plot them here."}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{
            width: 170, flexShrink: 0,
            padding: '12px 14px',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', gap: 10,
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
                const addr     = [p.city, p.country].filter(Boolean).join(', ');
                const hasCoords = p.latitude !== null && p.longitude !== null;
                const subtitle = p.type || addr || (hasCoords ? '' : 'No address in Smoobu');
                return (
                  <div key={String(p.apartmentId)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: hasCoords ? COLORS[i % COLORS.length] : '#d1d5db',
                      flexShrink: 0, marginTop: 2,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '.72rem', fontWeight: 600, color: 'var(--color-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.apartmentName || p.propertyName}
                      </div>
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