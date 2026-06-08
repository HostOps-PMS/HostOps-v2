// components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// Leaflet.js map + real markers + side legend.
//
// FIX (CSP): Previously loaded Leaflet from CDN via dynamic <script>
// injection, which was blocked by the server's Content-Security-Policy
// (scriptSrc: ["'self'"]).  Now imports Leaflet directly from the npm
// package so it is bundled by Vite — no external script needed.
//
// Run once in your project root if not already installed:
//   npm install leaflet leaflet.markercluster
//   npm install -D @types/leaflet
//
// Flow:
//   1. Dropdown 1 — Business Account  (from /api/accounts)
//   2. Dropdown 2 — Property          (DB properties of selected client)
//   3. Dropdown 3 — Room / Apartment  (from Smoobu sub-apartments; only
//                                      visible when a specific property
//                                      is selected)
//      Selecting a room highlights it in the legend and flies the map
//      to that marker, opening its popup automatically.
//
// Colour consistency:
//   Marker colour is derived from a stable hash of apartmentId — NOT
//   the array index.  This means legend dot colour always matches the
//   map marker colour even when some apartments have no coordinates
//   (those are excluded from the map but still shown in the legend).
//
// Coordinate handling:
//   Smoobu returns latitude/longitude as STRINGS ("9.7925080000000").
//   toCoord() calls parseFloat() and rejects non-finite values.
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

// ── Leaflet npm imports ───────────────────────────────────────────
// Bundled by Vite — no external script injection, no window.L, no CSP issues.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// markercluster: optional plugin for spiderfy on overlapping markers.
// Import order matters — core Leaflet must be imported first.
// If the package is not installed the catch below prevents a hard crash.
let markerClusterReady = false;
try {
  await import('leaflet.markercluster');
  await import('leaflet.markercluster/dist/MarkerCluster.css');
  await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
  markerClusterReady = true;
} catch {
  // Non-fatal: map works without clustering / spiderfy
  console.warn('[PropertyMap] leaflet.markercluster not installed — using plain markers');
}

// ── Fix Leaflet default icon paths broken by Vite asset hashing ──
// Without this every marker shows a broken image instead of the pin icon.
// We use a coloured divIcon anyway, but fixing it prevents console noise.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
});

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

// ── Stable colour from apartmentId ───────────────────────────────
// Uses a simple hash so the same apartment always gets the same colour
// regardless of its position in the sorted array.
function colorForId(id) {
  let h = 0;
  const s = String(id ?? '');
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(h) % COLORS.length];
}

// ── Jitter helper ─────────────────────────────────────────────────
// NOTE: No longer used by the map. We previously nudged overlapping
// markers apart by ~20m, which made rooms of the SAME building look
// scattered around the neighborhood (the "unrealistic positioning").
// That job is now handled properly by Leaflet.markercluster spiderfy:
// overlapping markers stay on their TRUE coordinates and fan out only
// when clicked. Helper is kept here for backward compatibility / reuse.
function applyCoordJitter(points) {
  const seen = {};
  return points.map((p) => {
    if (p.latitude === null || p.longitude === null) return p;
    const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
    const count = seen[key] ?? 0;
    seen[key] = count + 1;
    if (count === 0) return p;
    const angle = (count * (2 * Math.PI)) / 8;
    const r = 0.00018;
    return {
      ...p,
      latitude:  p.latitude  + r * Math.sin(angle),
      longitude: p.longitude + r * Math.cos(angle),
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function authHeaders() {
  const token = sessionStorage.getItem('hp_access_token') ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
    'x-api-key':    import.meta.env.VITE_API_KEY ?? '',
  };
}

function apiUrl(path) { return `${API_BASE}${path}`; }

// Smoobu returns lat/lng as strings like "9.7925080000000" — parseFloat them.
function toCoord(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

// ── Inject styles for permanent marker name labels ───────────────
// Each map marker shows its room name beside the dot (permanent Leaflet
// tooltip). When markers are collapsed inside a cluster, their labels are
// hidden automatically; they appear on spiderfy / when shown individually.
function ensurePmStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('#pm-map-styles')) return;
  const style = document.createElement('style');
  style.id = 'pm-map-styles';
  style.textContent = `
    .pm-marker-label{
      background:#fff;
      border:1px solid rgba(0,0,0,.12);
      border-radius:6px;
      box-shadow:0 1px 4px rgba(0,0,0,.18);
      padding:2px 7px;
      font-size:11px;
      font-weight:600;
      line-height:1.2;
      color:#1f2937;
      white-space:nowrap;
      font-family:var(--font-body, system-ui, sans-serif);
    }
    .pm-marker-label::before{ display:none !important; }

    /* Compact hover popup — replaces the big auto-opened popup */
    .pm-popup .leaflet-popup-content-wrapper{
      border-radius:10px;
      box-shadow:0 6px 20px rgba(0,0,0,.18);
      border:1px solid rgba(0,0,0,.06);
    }
    .pm-popup .leaflet-popup-content{
      margin:9px 11px;
      font-family:var(--font-body, system-ui, sans-serif);
    }
    .pm-popup .leaflet-popup-tip{
      box-shadow:0 6px 20px rgba(0,0,0,.12);
    }
  `;
  document.head.appendChild(style);
}

// ── Tiny HTML escape (for values injected into marker/cluster HTML) ──
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── Hook: client accounts ─────────────────────────────────────────
// FIX: Was calling /api/accounts (does not exist → 401 / HTML response).
// Correct endpoint is /api/clients which returns a plain array of users.
// Also fixed response parsing: /api/clients returns an array directly,
// not { users: [] }, so the old `data.users` always resolved to [].
function useClientAccounts() {
  const [clients, setClients]     = useState([]);
  const [acctLoading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(apiUrl('/api/clients'), {
          headers: authHeaders(), credentials: 'include',
        });
        if (!res.ok) throw new Error(`clients ${res.status}`);
        const data = await res.json();
        // /api/clients returns a plain array (not { users: [] })
        const users = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
        const mapped = users
          .filter((u) => u.role === 'client' || !u.role)
          .map((u) => ({
            id:         String(u._id || u.id),
            name:       u.businessName || u.firstName || u.email || 'Unnamed',
            properties: Array.isArray(u.properties) ? u.properties : [],
          }));
        if (!cancelled) setClients(mapped);
      } catch (err) {
        console.warn('[PropertyMap] clients fetch failed:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { clients, acctLoading };
}

// ── Hook: fetch Smoobu apartments for one client/property ─────────
// Calls GET /api/accounts/:clientId/smoobu-apartments[?propertyIndex=N]
// Backend hits Smoobu GET /apartments then GET /apartments/{id} for each
// one, returning location JSON with lat/lng as strings — toCoord() casts them.
function useSmoobuApartments(clientId, propertyIndex) {
  const [apartments, setApartments] = useState([]);
  const [aptLoading, setLoading]    = useState(false);
  const [aptError, setError]        = useState(null);

  const fetch_ = useCallback(async () => {
    if (!clientId) { setApartments([]); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const qs = (propertyIndex !== null && propertyIndex !== undefined)
        ? `?propertyIndex=${propertyIndex}` : '';
      const url = apiUrl(`/api/accounts/${clientId}/smoobu-apartments${qs}`);
      const res = await fetch(url, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `smoobu-apartments ${res.status}`);
      }
      const data = await res.json();
      // Always parseFloat coords — Smoobu returns them as strings
      const apts = (Array.isArray(data.allApartments) ? data.allApartments : []).map((a) => ({
        ...a,
        latitude:  toCoord(a.latitude),
        longitude: toCoord(a.longitude),
      }));
      const withCoords = apts.filter(a => a.latitude !== null && a.longitude !== null).length;
      console.log(`[PropertyMap] smoobu-apartments client=${clientId} propIdx=${propertyIndex ?? 'all'} → ${apts.length} apts (${withCoords} with coords)`);
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
// markerMapRef: exposed ref to { apartmentId → L.Marker } so the
// component can fly-to and open a specific marker from the room dropdown.
//
// NOTE: L is now a bundled import, not window.L. The map is created
// directly — no async CDN loading, no leafletReady / leafletError state.
function useLeafletMap(containerRef, plottable, markerMapRef, focusedAptId) {
  const mapRef     = useRef(null);
  const markersRef = useRef([]);
  // clusterRef holds the active layer that contains all markers — either a
  // L.markerClusterGroup (spiderfy enabled) or a plain L.layerGroup fallback.
  const clusterRef = useRef(null);

  // Init / re-init map when DOM node becomes available
  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmStyles();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      clusterRef.current = null;
      if (markerMapRef) markerMapRef.current = {};
    }
    const map = L.map(containerRef.current, {
      center: [14.5, 121.0], zoom: 6,
      zoomControl: true, scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // Robust sizing: the map often initialises while its container is still
    // settling (or was behind a skeleton), which leaves half-loaded tiles.
    // Fire invalidateSize a few times AND watch the container for resizes.
    [60, 200, 450].forEach((ms) => setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, ms));

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      });
      ro.observe(containerRef.current);
    }

    return () => {
      if (ro) { try { ro.disconnect(); } catch { /* noop */ } }
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      clusterRef.current = null;
      if (markerMapRef) markerMapRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  // Update markers whenever plottable list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Tear down the previous layer (cluster group or layer group) + markers
    if (clusterRef.current) {
      try { map.removeLayer(clusterRef.current); } catch { /* noop */ }
      clusterRef.current = null;
    }
    markersRef.current.forEach((m) => { try { m.remove(); } catch { /* noop */ } });
    markersRef.current = [];
    if (markerMapRef) markerMapRef.current = {};

    if (plottable.length === 0) return;

    // ── Build the container layer ─────────────────────────────────
    // Prefer markercluster (real spiderfy for overlapping markers).
    // If the plugin didn't load, fall back to a plain layer group so the
    // map still renders every marker (just without clustering/spiderfy).
    const canCluster = markerClusterReady && typeof L.markerClusterGroup === 'function';
    const layer = canCluster
      ? L.markerClusterGroup({
          showCoverageOnHover:        false,  // don't draw the polygon hull
          zoomToBoundsOnClick:        true,   // zoom in on cluster click…
          spiderfyOnMaxZoom:          true,   // …and spiderfy when zoom can't split them
          spiderfyDistanceMultiplier: 1.6,    // how far the legs fan out
          maxClusterRadius:           45,     // px radius that groups markers
          removeOutsideVisibleBounds: false,
          // Pretty cluster pill: shows the PROPERTY NAME (e.g. "Haido Ville")
          // instead of a bare number. A small chip on the right keeps the
          // count. If a cluster spans multiple properties (only possible in
          // "All accounts" view), we show "N properties" instead.
          iconCreateFunction: (cluster) => {
            const children = cluster.getAllChildMarkers();
            const count    = cluster.getChildCount();

            const names = [...new Set(
              children.map((m) => m.pmMeta?.propertyName).filter(Boolean)
            )];

            let labelText;
            if (names.length === 1)      labelText = names[0];
            else if (names.length > 1)   labelText = `${names.length} properties`;
            else                         labelText = 'Properties';

            // Stable dot colour per property (brand red when mixed)
            const dotColor = names.length === 1 ? colorForId(names[0]) : '#A10000';

            // Rough width so markercluster can centre the pill correctly
            const w = Math.min(232, Math.max(86, labelText.length * 7 + 74));

            return L.divIcon({
              className: '',
              html: `<div style="
                display:flex;align-items:center;gap:7px;
                height:30px;padding:0 6px 0 10px;
                background:#fff;border:1px solid rgba(0,0,0,.10);
                border-radius:999px;
                box-shadow:0 2px 10px rgba(0,0,0,.22);
                font-family:var(--font-body, system-ui, sans-serif);
                white-space:nowrap;cursor:pointer;
              ">
                <span style="width:10px;height:10px;border-radius:50%;background:${dotColor};
                  box-shadow:0 0 0 3px ${dotColor}26;flex:none;"></span>
                <span style="font-size:12px;font-weight:700;color:#1f2937;
                  max-width:150px;overflow:hidden;text-overflow:ellipsis;">
                  ${escHtml(labelText)}
                </span>
                <span style="display:inline-flex;align-items:center;justify-content:center;
                  min-width:20px;height:20px;padding:0 5px;border-radius:999px;
                  background:linear-gradient(135deg,#c81e1e,#A10000);
                  color:#fff;font-size:11px;font-weight:700;line-height:1;flex:none;">
                  ${count}
                </span>
              </div>`,
              iconSize:   [w, 30],
              iconAnchor: [w / 2, 15],
            });
          },
        })
      : L.layerGroup();

    const bounds = [];

    // IMPORTANT: markers now use their TRUE Smoobu coordinates (no jitter).
    // Overlapping rooms of the same building are collapsed into one cluster
    // bubble and fan out (spiderfy) only when clicked — realistic positioning.
    plottable.forEach((p) => {
      // Use stable colour derived from apartmentId — not array index
      const color  = colorForId(p.apartmentId);
      const label  = p.apartmentName || p.propertyName || '';
      const addr   = [p.street, p.city, p.country].filter(Boolean).join(', ');
      const client = p.clientName || '';

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

      // Stash metadata so the cluster bubble can show the property name
      marker.pmMeta = {
        propertyName:  p.propertyName || '',
        apartmentName: label,
        clientName:    client,
        color,
      };

      const popupHtml = `
        <div style="font-size:11.5px;line-height:1.45;min-width:150px;max-width:220px;">
          <div style="font-weight:700;font-size:12.5px;margin-bottom:2px;color:#111827;">${escHtml(label)}</div>
          ${client ? `<div style="color:#1a9e6e;font-weight:600;">${escHtml(client)}</div>` : ''}
          ${addr    ? `<div style="color:#6b7280;">${escHtml(addr)}</div>` : ''}
          ${p.type  ? `<div style="color:#6b7280;">${escHtml(p.type)}</div>` : ''}
          ${p.maxOccupancy != null ? `<div style="color:#6b7280;">Max occupancy: ${p.maxOccupancy}</div>` : ''}
          ${p.bedrooms != null ? `<div style="color:#6b7280;">Bedrooms: ${p.bedrooms}${p.bathrooms != null ? ` · Bathrooms: ${p.bathrooms}` : ''}</div>` : ''}
        </div>`;
      // Compact popup — no close button, no auto-pan; shown on HOVER only.
      marker.bindPopup(popupHtml, {
        closeButton: false,
        autoPan:     false,
        offset:      [0, -4],
        className:   'pm-popup',
        minWidth:    150,
        maxWidth:    230,
      });

      // ── Hover-to-show details (with small anti-flicker delay) ─────
      // Opens the compact popup on hover and keeps it open while the
      // cursor is over either the marker OR the popup itself.
      let hideTimer = null;
      const openDetails = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        marker.openPopup();
      };
      const closeDetailsSoon = () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => marker.closePopup(), 120);
      };
      marker.on('mouseover', openDetails);
      marker.on('mouseout',  closeDetailsSoon);
      marker.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (el) {
          el.addEventListener('mouseenter', openDetails);
          el.addEventListener('mouseleave', closeDetailsSoon);
        }
      });

      // Permanent name label beside the dot — "not dot lang".
      // Hidden automatically while collapsed inside a cluster; shows on
      // spiderfy and when the marker is displayed on its own.
      if (label) {
        marker.bindTooltip(label, {
          permanent: true,
          direction: 'right',
          offset:    [10, 0],
          className: 'pm-marker-label',
          opacity:   1,
        });
      }

      // Add to the cluster/layer group instead of straight onto the map
      layer.addLayer(marker);

      markersRef.current.push(marker);
      if (markerMapRef) markerMapRef.current[String(p.apartmentId)] = marker;
      bounds.push([p.latitude, p.longitude]);
    });

    layer.addTo(map);
    clusterRef.current = layer;

    // Zoom straight in to the location (street level). For a single point we
    // jump to FOCUS_ZOOM; for several we fit them but still allow a deep zoom.
    const FOCUS_ZOOM = 18;
    if (bounds.length === 1)      map.setView(bounds[0], FOCUS_ZOOM);
    else if (bounds.length > 1)   map.fitBounds(bounds, { padding: [40, 40], maxZoom: FOCUS_ZOOM });
  }, [plottable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus a single apartment when a room is picked (dropdown OR legend click).
  // With clustering, the target marker may be hidden inside a cluster, so we
  // use zoomToShowLayer() — it zooms/spiderfies until the marker is exposed,
  // then we centre on it. Details are shown on HOVER now, so we no longer
  // auto-open the (formerly oversized) popup.
  useEffect(() => {
    if (!focusedAptId || !markerMapRef?.current) return;
    const marker  = markerMapRef.current[String(focusedAptId)];
    const map     = mapRef.current;
    const cluster = clusterRef.current;
    if (!marker || !map) return;

    if (cluster && typeof cluster.zoomToShowLayer === 'function') {
      // markercluster path — un-cluster / spiderfy, then max-zoom + centre
      cluster.zoomToShowLayer(marker, () => {
        const m = mapRef.current;
        if (m) m.setView(marker.getLatLng(), 18, { animate: true });
      });
    } else {
      // plain-marker fallback path
      map.flyTo(marker.getLatLng(), 18, { animate: true, duration: 0.8 });
    }
  }, [focusedAptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // No leafletError / retryLeaflet needed — Leaflet is bundled, always available.
  return {};
}

// ── Main Component ────────────────────────────────────────────────
export default function PropertyMap({ mapLocations, loading }) {
  const [selectedClient,    setSelectedClient]    = useState('all');
  const [selectedPropIndex, setSelectedPropIndex] = useState(null);
  // Third dropdown: selected room/apartment id (string)
  const [selectedAptId,     setSelectedAptId]     = useState('');

  // markerMapRef holds { apartmentId → L.Marker } for fly-to
  const markerMapRef = useRef({});

  const { clients, acctLoading } = useClientAccounts();

  const activeClient = useMemo(
    () => clients.find((c) => c.id === selectedClient) ?? null,
    [clients, selectedClient]
  );

  function handleClientChange(clientId) {
    setSelectedClient(clientId);
    setSelectedPropIndex(null);
    setSelectedAptId('');
  }

  function handlePropChange(raw) {
    setSelectedPropIndex(raw === '' || raw === null || raw === 'all' ? null : Number(raw));
    setSelectedAptId('');
  }

  function handleAptChange(aptId) {
    setSelectedAptId(aptId);
  }

  // Fetch from Smoobu whenever a specific client is selected
  const smoobuClientId = selectedClient !== 'all' ? selectedClient : null;

  const { apartments: smoobuApts, aptLoading, aptError } =
    useSmoobuApartments(smoobuClientId, selectedPropIndex);

  // Normalise overview coords (may also be strings)
  const overviewLocs = useMemo(() =>
    (Array.isArray(mapLocations) ? mapLocations : []).map((l) => ({
      ...l,
      latitude:  toCoord(l.latitude),
      longitude: toCoord(l.longitude),
    })),
  [mapLocations]);

  // ── Build full location list (legend + map source) ─────────────
  const locations = useMemo(() => {
    if (smoobuClientId) {
      // While loading, show DB property names as placeholders
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

    // All accounts mode — overviewLocs first, then DB-only stubs for
    // any client that has no Smoobu entry yet
    const clientsWithSmoobu = new Set(overviewLocs.map((l) => l.clientId));
    const stubs = [];
    clients.forEach((client) => {
      if (clientsWithSmoobu.has(client.id)) return;
      if (client.properties.length === 0) {
        stubs.push({
          apartmentId: `db:${client.id}`, apartmentName: '(no properties)',
          propertyName: '(no properties)', clientId: client.id, clientName: client.name,
          street: '', zip: '', city: '', country: '', latitude: null, longitude: null,
        });
      } else {
        client.properties.forEach((prop, pi) => {
          stubs.push({
            apartmentId: `db:${client.id}:${pi}`, apartmentName: prop.propertyName || 'Property',
            propertyName: prop.propertyName || 'Property', clientId: client.id, clientName: client.name,
            street: '', zip: '', city: '', country: '', latitude: null, longitude: null,
          });
        });
      }
    });
    return [...overviewLocs, ...stubs];
  }, [smoobuClientId, selectedPropIndex, smoobuApts, aptLoading,
      clients, overviewLocs, activeClient]);

  // Only entries with valid numeric coords go on the map
  const plottable = useMemo(() =>
    locations.filter(
      (l) => l.latitude !== null && l.longitude !== null &&
             Number.isFinite(l.latitude) && Number.isFinite(l.longitude)
    ),
  [locations]);

  // The focusedAptId drives the fly-to effect in useLeafletMap
  const focusedAptId = selectedAptId || null;

  // ── What actually gets plotted on the map ──────────────────────
  // When a single room is selected (focusedAptId), we isolate it so it
  // shows ALONE on the map (no surrounding markers/clusters) — this is the
  // "makita sya mag-isa" behaviour. The side legend still lists everything,
  // so the user can pick a different room any time.
  // When nothing is focused, we plot all coords (clustered + spiderfy).
  const mapPoints = useMemo(() => {
    if (focusedAptId) {
      const one = plottable.find((p) => String(p.apartmentId) === focusedAptId);
      if (one) return [one];
    }
    return plottable;
  }, [plottable, focusedAptId]);

  // ── Leaflet map ────────────────────────────────────────────────
  const mapContainerRef = useRef(null);
  useLeafletMap(mapContainerRef, mapPoints, markerMapRef, focusedAptId);

  // ── Dropdown options ───────────────────────────────────────────
  const propertyOptions = useMemo(() => {
    if (!activeClient) return [];
    return activeClient.properties.map((p, i) => ({
      index: i,
      name:  p.propertyName || `Property ${i + 1}`,
    }));
  }, [activeClient]);

  // Room dropdown options — only apartments that have coords (can be shown on map)
  // If no coords exist yet, still show all so the user knows what was fetched.
  const roomOptions = useMemo(() => {
    if (!smoobuClientId || selectedPropIndex === null) return [];
    if (smoobuApts.length === 0) return [];
    return smoobuApts.map((a) => ({
      id:       String(a.apartmentId),
      name:     a.apartmentName || a.propertyName || `Apt ${a.apartmentId}`,
      hasCoord: a.latitude !== null && a.longitude !== null,
    }));
  }, [smoobuClientId, selectedPropIndex, smoobuApts]);

  const isDropdownLoading = acctLoading;
  const isMapLoading      = loading || aptLoading;

  const statusText = useMemo(() => {
    if (aptLoading)   return 'Fetching Smoobu sub-apartments…';
    if (aptError)     return `Smoobu error: ${aptError}`;
    if (isMapLoading) return 'Loading coordinates…';
    if (focusedAptId) {
      const apt = smoobuApts.find(a => String(a.apartmentId) === focusedAptId);
      if (apt) return `Showing: ${apt.apartmentName || apt.propertyName}`;
    }
    const source = smoobuClientId ? '(live from Smoobu)' : '(from overview)';
    return `${plottable.length} of ${locations.length} mapped ${source}`;
  }, [aptLoading, aptError, isMapLoading, smoobuClientId, focusedAptId,
      smoobuApts, plottable.length, locations.length]);

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

          {/* Dropdown 1 — Business Account */}
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

          {/* Dropdown 2 — Property (only when a client is selected) */}
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

          {/* Dropdown 3 — Room / Apartment (only when a specific property is selected
                          AND Smoobu returned at least one apartment) */}
          {selectedClient !== 'all' && selectedPropIndex !== null && roomOptions.length > 0 && (
            <select
              value={selectedAptId}
              onChange={(e) => handleAptChange(e.target.value)}
              disabled={aptLoading}
              style={dropdownStyle(aptLoading)}
            >
              <option value="">All rooms ({roomOptions.length})</option>
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.hasCoord}>
                  {r.name}{!r.hasCoord ? ' (no coords)' : ''}
                </option>
              ))}
            </select>
          )}

        </div>
      </div>

      {/* ── Map + legend ──
          The map container is ALWAYS mounted (Leaflet inits once and keeps
          its size). While loading we lay a skeleton OVER it instead of
          unmounting it — this fixes the half-rendered / broken-tiles look. */}
      <div style={{ position: 'relative', display: 'flex', height: 325, overflow: 'hidden', borderRadius: '0 0 var(--radius-card, 12px) var(--radius-card, 12px)' }}>

          {/* Leaflet map container */}
          <div
            ref={mapContainerRef}
            style={{ flex: 1, minWidth: 0, zIndex: 0, overflow: 'hidden', position: 'relative' }}
          >
            {/* No coords set — informational overlay (never shown during loading) */}
            {!isMapLoading && locations.length > 0 && plottable.length === 0 && (
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

          {/* Legend — colour derived from apartmentId hash, not array index */}
          <div style={{
            width: 175, flexShrink: 0,
            padding: '8px 10px',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', gap: 4,
            overflowY: 'auto',
          }}>
            {isDropdownLoading ? (
              <div style={{ fontSize: '.72rem', color: 'var(--color-muted)' }}>Loading properties…</div>
            ) : locations.length === 0 ? (
              <div style={{ fontSize: '.72rem', color: 'var(--color-muted)' }}>No properties to display.</div>
            ) : (
              locations.map((p) => {
                const addrParts = [p.street, p.city, p.country].filter(Boolean);
                const addr      = addrParts.join(', ');
                const hasCoords = p.latitude !== null && p.longitude !== null &&
                                  Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
                // Stable colour from id — matches the map marker
                const dotColor  = hasCoords ? colorForId(p.apartmentId) : '#d1d5db';
                const subtitle  = addr || p.type || (hasCoords ? '' : 'No address in Smoobu');
                // Highlight the focused apartment in the legend
                const isFocused = focusedAptId && String(p.apartmentId) === focusedAptId;
                return (
                  <div
                    key={String(p.apartmentId)}
                    onClick={() => {
                      if (!hasCoords) return;
                      handleAptChange(
                        String(p.apartmentId) === focusedAptId ? '' : String(p.apartmentId)
                      );
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      cursor: hasCoords ? 'pointer' : 'default',
                      background: isFocused ? 'var(--color-surface-2, #f0faf5)' : 'transparent',
                      borderRadius: 6,
                      padding: '2px 4px',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0, marginTop: 3,
                      boxShadow: isFocused ? `0 0 0 2px ${dotColor}55` : 'none',
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '.7rem', fontWeight: isFocused ? 700 : 600, lineHeight: 1.25,
                        color: isFocused ? 'var(--color-brand)' : 'var(--color-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.apartmentName || p.propertyName}
                      </div>
                      {p.propertyName && p.apartmentName !== p.propertyName && (
                        <div style={{
                          fontSize: '.63rem', color: 'var(--color-muted)', lineHeight: 1.2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.propertyName}
                        </div>
                      )}
                      <div style={{
                        fontSize: '.63rem', color: 'var(--color-brand)', fontWeight: 600, lineHeight: 1.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.clientName}
                      </div>
                      <div style={{
                        fontSize: '.61rem', color: 'var(--color-muted)', lineHeight: 1.2,
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

          {/* Loading overlay — sits ON TOP of the (still-mounted) map */}
          {isMapLoading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1300,
              background: 'var(--color-surface, #fff)',
              padding: 16,
            }}>
              <div className="db-skeleton" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
            </div>
          )}
        </div>
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