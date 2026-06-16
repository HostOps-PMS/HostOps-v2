import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
});

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4',
                '#ec4899','#14b8a6','#f97316','#a855f7'];

const MAP_STYLES = {
  standard: {
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com">Esri</a> — Esri, Maxar, Earthstar Geographics',
  },
};

function colorForId(id) {
  let h = 0;
  const s = String(id ?? '');
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(h) % COLORS.length];
}

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
import { fetchWithAuth, uploadHeaders } from '../../../lib/authUtils';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'https://api.hostops.online'
).replace(/\/$/, '');

function apiUrl(path) { return `${API_BASE}${path}`; }

// ── Upload one or more photos for a Smoobu apartment ──────────────
// POSTs multipart/form-data to the backend, which stores them on
// Cloudinary and returns the full updated image list [{ id, url }].
// NOTE: we deliberately do NOT set Content-Type — the browser must set
// the multipart boundary itself for FormData to parse correctly.
async function uploadApartmentPhotos(clientId, apartmentId, files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('photos', f));
  const res = await fetch(
    apiUrl(`/api/accounts/${clientId}/smoobu-apartments/${apartmentId}/photos`),
    {
      method: 'POST',
      headers: uploadHeaders(),
      credentials: 'include',
      body: fd,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `upload failed (${res.status})`);
  return Array.isArray(data.images) ? data.images : [];
}

// Smoobu returns lat/lng as strings like "9.7925080000000" — parseFloat them.
function toCoord(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

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
        const res = await fetchWithAuth(apiUrl('/api/clients'));
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
      const res = await fetchWithAuth(url);
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
        // Ensure images is always an array — backend guarantees this but guard anyway
        images: Array.isArray(a.images) ? a.images : [],
      }));
      const withCoords = apts.filter(a => a.latitude !== null && a.longitude !== null).length;
      console.log(`[PropertyMap] smoobu-apartments client=${clientId} propIdx=${propertyIndex ?? 'all'} → ${apts.length} apts (${withCoords} with coords)`, apts[0]);
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

// ── Hook: fetch images for a single apartment on demand ──────────
// Used in "all accounts" mode when overview data has no images for an apt.
// Fires only when a legend item is clicked — not on initial load.
// Passes the specific apartmentId in the query so the server can narrow
// the fetch to just that one apartment, avoiding a full-list round-trip.
function useApartmentImages(clientId, apartmentId) {
  const [images, setImages]   = useState(null); // null = not fetched yet
  const [imgLoading, setLoad] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!clientId || !apartmentId) { setImages(null); return; }
    // Skip stubs (db: / stub: prefixed ids have no Smoobu detail)
    if (String(apartmentId).startsWith('db:') || String(apartmentId).startsWith('stub:')) {
      setImages([]);
      return;
    }
    setLoad(true);
    try {
      // Fetch ALL apartments for this client — the backend call is already
      // cached for 60 s, so a second call within that window is effectively free.
      const url = apiUrl(`/api/accounts/${clientId}/smoobu-apartments`);
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`smoobu-apartments ${res.status}`);
      const data = await res.json();
      const match = (data.allApartments || []).find(
        (a) => String(a.apartmentId) === String(apartmentId)
      );
      setImages(Array.isArray(match?.images) ? match.images : []);
    } catch (err) {
      console.warn('[PropertyMap] image fetch failed:', err.message);
      setImages([]);
    } finally {
      setLoad(false);
    }
  }, [clientId, apartmentId]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { images, imgLoading };
}

// ── Leaflet map hook ──────────────────────────────────────────────
// markerMapRef: exposed ref to { apartmentId → L.Marker } so the
// component can fly-to and open a specific marker from the room dropdown.
//
// NOTE: L is now a bundled import, not window.L. The map is created
// directly — no async CDN loading, no leafletReady / leafletError state.
function useLeafletMap(containerRef, plottable, markerMapRef, focusedAptId, mapStyle = 'standard', extraDep = undefined) {
  const mapRef     = useRef(null);
  const markersRef = useRef([]);
  const clusterRef = useRef(null);
  const tileRef    = useRef(null);

  // Init / re-init map when DOM node becomes available.
  // extraDep lets callers (e.g. a modal) trigger re-init when they become visible,
  // because ref.current is still null during the render phase when the container
  // first mounts — it's only set after commit, which is when this effect runs.
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
    const initStyle = MAP_STYLES[mapStyle] ?? MAP_STYLES.standard;
    tileRef.current = L.tileLayer(initStyle.url, {
      attribution: initStyle.attribution,
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
  }, [containerRef.current, extraDep]);

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

      const popupHtml = (() => {
        const firstImg  = Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : null;
        const imgCount  = Array.isArray(p.images) ? p.images.length : 0;
        const heroHtml  = firstImg
          ? `<img src="${escHtml(firstImg)}" alt="${escHtml(label)}" style="width:100%;height:90px;object-fit:cover;display:block;" loading="lazy" />`
          : `<div style="height:90px;background:linear-gradient(135deg,#9FE1CB,#085041);display:flex;align-items:center;justify-content:center;position:relative;">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M3 9h18"/></svg>
               <span style="position:absolute;bottom:7px;left:9px;font-size:10px;color:rgba(255,255,255,0.85);background:rgba(0,0,0,0.28);padding:2px 8px;border-radius:20px;">No photo yet · Add one →</span>
             </div>`;
        const countBadge = firstImg && imgCount > 1
          ? `<span style="position:absolute;top:6px;right:8px;font-size:9.5px;color:#fff;background:rgba(0,0,0,0.42);padding:2px 7px;border-radius:20px;">📷 ${imgCount}</span>`
          : '';
        return `
          <div style="font-size:11.5px;line-height:1.45;width:220px;overflow:hidden;border-radius:10px;margin:-9px -11px;">
            <div style="position:relative;overflow:hidden;">
              ${heroHtml}
              ${countBadge}
            </div>
            <div style="padding:10px 12px 12px;">
              <div style="font-weight:700;font-size:13px;margin-bottom:2px;color:#111827;">${escHtml(label)}</div>
              ${client ? `<div style="color:#1a9e6e;font-weight:600;font-size:11.5px;margin-bottom:5px;">${escHtml(client)}</div>` : ''}
              ${addr ? `<div style="display:flex;align-items:flex-start;gap:4px;color:#6b7280;font-size:11px;margin-bottom:3px;"><span>📍</span><span>${escHtml(addr)}</span></div>` : ''}
              ${p.type || p.maxOccupancy != null ? `<div style="display:flex;align-items:center;gap:4px;color:#6b7280;font-size:11px;"><span>🏠</span><span>${escHtml(p.type || '')}${p.type && p.maxOccupancy != null ? ' · ' : ''}${p.maxOccupancy != null ? 'Max ' + p.maxOccupancy : ''}</span></div>` : ''}
            </div>
          </div>`;
      })();
      // Compact popup — shown on HOVER only. autoPan keeps the popup inside the
      // map container (overflow:hidden clips it otherwise near the edges).
      marker.bindPopup(popupHtml, {
        closeButton:    false,
        autoPan:        true,
        autoPanPadding: [20, 20],
        offset:         [0, -4],
        className:      'pm-popup',
        minWidth:       150,
        maxWidth:       230,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      try { map.removeLayer(tileRef.current); } catch { /* noop */ }
    }
    const style = MAP_STYLES[mapStyle] ?? MAP_STYLES.standard;
    tileRef.current = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  return {};
}

// ── PhotoCarousel — used in the modal Detail panel ────────────────
// Shows self-hosted apartment photos with prev/next navigation.
// Falls back to the branded gradient when no images are available.
// `onAddPhoto` (when provided + canAdd) makes the "Add photo" controls
// clickable so admins can upload images for the apartment.
function PhotoCarousel({ images = [], altText = '', onAddPhoto = null, uploading = false, canAdd = false }) {
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(null);
  const valid = images.filter((img) => img && img.url);

  // Keep index in range when the image list shrinks/grows
  useEffect(() => { setIdx((i) => (valid.length === 0 ? 0 : Math.min(i, valid.length - 1))); }, [valid.length]);

  const triggerAdd = () => { if (canAdd && onAddPhoto && !uploading) onAddPhoto(); };

  if (valid.length === 0) {
    return (
      <div style={{
        height: 140,
        background: 'linear-gradient(135deg,#9FE1CB,#085041)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', flexShrink: 0, overflow: 'hidden',
      }}>
        <span style={{ fontSize: 36, opacity: 0.45 }}>🏢</span>
        <span style={{
          position: 'absolute', bottom: 8, left: 10,
          fontSize: '.63rem', color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.28)', padding: '2px 8px', borderRadius: 20,
        }}>{uploading ? 'Uploading…' : 'No photo yet'}</span>
        {canAdd && (
          <button
            onClick={triggerAdd}
            disabled={uploading}
            style={{
              position: 'absolute', bottom: 8, right: 10,
              fontSize: '.63rem', background: 'rgba(255,255,255,0.92)',
              border: 'none', padding: '3px 9px', borderRadius: 20,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 600,
            }}
          >↑ Add photo</button>
        )}
      </div>
    );
  }

  const prev = () => setIdx((i) => (i - 1 + valid.length) % valid.length);
  const next = () => setIdx((i) => (i + 1) % valid.length);
  const safeIdx = Math.min(idx, valid.length - 1);

  return (
    <div style={{ position: 'relative', height: 140, flexShrink: 0, overflow: 'hidden', background: '#111' }}>
      <img
        key={valid[safeIdx].url}
        src={valid[safeIdx].url}
        alt={altText}
        onClick={() => setLightboxOpen(true)}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', display: 'block',
          transition: 'opacity 0.2s',
          cursor: 'zoom-in',
        }}
        loading="lazy"
      />
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(diff) < 40) return;
            e.stopPropagation();
            if (diff < 0) setIdx((i) => (i + 1) % valid.length);
            else          setIdx((i) => (i - 1 + valid.length) % valid.length);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: '1.2rem',
              width: 36, height: 36, borderRadius: '50%',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
          {valid.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + valid.length) % valid.length); }}
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: '#fff', fontSize: '1.4rem',
                width: 44, height: 44, borderRadius: '50%',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >‹</button>
          )}
          <img
            src={valid[safeIdx].url}
            alt={altText}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          />
          {valid.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % valid.length); }}
              style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: '#fff', fontSize: '1.4rem',
                width: 44, height: 44, borderRadius: '50%',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >›</button>
          )}
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.7)', fontSize: '.8rem',
          }}>
            {safeIdx + 1} / {valid.length}
          </div>
        </div>
      )}
      {/* Count badge */}
      <span style={{
        position: 'absolute', top: 8, right: 8,
        fontSize: '.6rem', color: '#fff',
        background: 'rgba(0,0,0,0.50)', padding: '2px 8px', borderRadius: 20,
        pointerEvents: 'none',
      }}>
        📷 {safeIdx + 1} / {valid.length}
      </span>
      {/* Add-more button (top-left) */}
      {canAdd && (
        <button
          onClick={triggerAdd}
          disabled={uploading}
          style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: '.6rem', color: '#fff', fontWeight: 600,
            background: 'rgba(0,0,0,0.50)', border: 'none',
            padding: '2px 8px', borderRadius: 20,
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >{uploading ? 'Uploading…' : '+ Add'}</button>
      )}
      {/* Prev / Next — only shown when there are multiple images */}
      {valid.length > 1 && (
        <>
          <button
            onClick={prev}
            style={{
              position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
              width: 26, height: 26, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)', color: '#fff',
              fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Previous photo"
          >‹</button>
          <button
            onClick={next}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 26, height: 26, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)', color: '#fff',
              fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Next photo"
          >›</button>
          {/* Dot indicators */}
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4,
          }}>
            {valid.map((_, di) => (
              <button
                key={di}
                onClick={() => setIdx(di)}
                style={{
                  width: di === safeIdx ? 14 : 6,
                  height: 6, borderRadius: 3,
                  border: 'none', padding: 0,
                  background: di === safeIdx ? '#fff' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', transition: 'width 0.2s, background 0.2s',
                }}
                aria-label={`Photo ${di + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}


export default function PropertyMap({ mapLocations, loading }) {
  const [selectedClient,    setSelectedClient]    = useState('all');
  const [selectedPropIndex, setSelectedPropIndex] = useState(null);
  // Third dropdown: selected room/apartment id (string)
  const [selectedAptId,     setSelectedAptId]     = useState('');
  const [isModalOpen,       setIsModalOpen]        = useState(false);
  const [mapStyle,          setMapStyle]            = useState('standard');
  const [selectedLegendApt, setSelectedLegendApt]   = useState(null);
  const [legendSearch,       setLegendSearch]        = useState('');
  const [activeTab,          setActiveTab]           = useState('properties'); // 'properties' | 'detail'
  // ── Photo upload state (Detail panel) ──
  const [uploadedImages, setUploadedImages] = useState(null); // overrides detailImages after a successful upload
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState(null);
  // apartmentId → images[] : lets freshly-uploaded photos appear on the map
  // markers/popups (and legend) immediately, without refetching everything.
  const [photoOverrides, setPhotoOverrides] = useState({});
  // Tracks apartmentIds we've already looked photos up for (avoids refetch loops).
  const attemptedPhotoIdsRef = useRef(new Set());
  const photoInputRef = useRef(null);
  const modalMapContainerRef = useRef(null);
  const modalMarkerMapRef    = useRef({});

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
    setSelectedLegendApt(null);
    setLegendSearch('');
    setActiveTab('properties');
  }

  function handlePropChange(raw) {
    setSelectedPropIndex(raw === '' || raw === null || raw === 'all' ? null : Number(raw));
    setSelectedAptId('');
    setSelectedLegendApt(null);
    setLegendSearch('');
    setActiveTab('properties');
  }

  function handleAptChange(aptId) {
    setSelectedAptId(aptId);
  }

  // Fetch from Smoobu whenever a specific client is selected
  const smoobuClientId = selectedClient !== 'all' ? selectedClient : null;

  const { apartments: smoobuApts, aptLoading, aptError } =
    useSmoobuApartments(smoobuClientId, selectedPropIndex);

  // On-demand image fetch for "all accounts" mode (overview locs have no images).
  // clientId comes from the clicked apartment's clientId field.
  const legendImgClientId = selectedLegendApt?.clientId ?? null;
  const legendImgAptId    = selectedLegendApt?.apartmentId ?? null;
  // Only trigger when the apt genuinely has no images (avoid redundant calls
  // when images were already fetched via useSmoobuApartments above).
  const needsImgFetch = selectedLegendApt != null &&
    (!Array.isArray(selectedLegendApt.images) || selectedLegendApt.images.length === 0) &&
    !String(legendImgAptId ?? '').startsWith('db:') &&
    !String(legendImgAptId ?? '').startsWith('stub:');
  const { images: fetchedImages, imgLoading } = useApartmentImages(
    needsImgFetch ? legendImgClientId : null,
    needsImgFetch ? legendImgAptId    : null
  );
  // Merge: a fresh upload wins; otherwise prefer already-attached images,
  // falling back to on-demand fetched ones.
  const detailImages = (Array.isArray(uploadedImages))
    ? uploadedImages
    : (Array.isArray(selectedLegendApt?.images) && selectedLegendApt.images.length > 0)
      ? selectedLegendApt.images
      : (fetchedImages ?? []);

  // Reset upload override + error whenever a different apartment is selected.
  useEffect(() => {
    setUploadedImages(null);
    setUploadError(null);
  }, [selectedLegendApt?.apartmentId]);

  // Photos can only be added to real Smoobu apartments (not db:/stub: entries).
  const canAddPhoto = selectedLegendApt != null &&
    !!selectedLegendApt.clientId &&
    !!selectedLegendApt.apartmentId &&
    !String(selectedLegendApt.apartmentId).startsWith('db:') &&
    !String(selectedLegendApt.apartmentId).startsWith('stub:');

  const triggerAddPhoto = () => {
    setUploadError(null);
    if (photoInputRef.current) photoInputRef.current.click();
  };

  async function handlePhotoFiles(files) {
    if (!files || files.length === 0 || !selectedLegendApt) return;
    const cId = selectedLegendApt.clientId;
    const aId = selectedLegendApt.apartmentId;
    if (!canAddPhoto) { setUploadError('Cannot add photos to this entry.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const images = await uploadApartmentPhotos(cId, aId, files);
      setUploadedImages(images);
      // Make the new photos show up on the map popup + legend right away.
      attemptedPhotoIdsRef.current.add(String(aId));
      setPhotoOverrides((prev) => ({ ...prev, [String(aId)]: images }));
    } catch (err) {
      console.warn('[PropertyMap] photo upload failed:', err.message);
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // Normalise overview coords (may also be strings)
  const overviewLocs = useMemo(() =>
    (Array.isArray(mapLocations) ? mapLocations : []).map((l) => ({
      ...l,
      latitude:  toCoord(l.latitude),
      longitude: toCoord(l.longitude),
      // Ensure images is always an array — overview data may not include it
      images: Array.isArray(l.images) ? l.images : [],
    })),
  [mapLocations]);

  // ── Build full location list (legend + map source) ─────────────
  const locations = useMemo(() => {
    // Merge any uploaded/stored photos (by apartmentId) into a location list.
    // Only a NON-EMPTY override wins, so we never wipe images that the
    // backend already attached.
    const applyOv = (arr) => arr.map((l) => {
      const ov = photoOverrides[String(l.apartmentId)];
      return (ov && ov.length > 0) ? { ...l, images: ov } : l;
    });

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
      return applyOv(smoobuApts);
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
    return applyOv([...overviewLocs, ...stubs]);
  }, [smoobuClientId, selectedPropIndex, smoobuApts, aptLoading,
      clients, overviewLocs, activeClient, photoOverrides]);

  // ── Prefetch self-hosted photos for all visible apartments ──────
  // Reads straight from the photo store (one bulk request), so photos show
  // on every marker / legend / detail entry regardless of whether the Smoobu
  // apartment-list merge ran. This is what keeps photos visible after you
  // select a client or filter to a property.
  const visibleRealAptIds = useMemo(() =>
    [...new Set(
      locations
        .map((l) => String(l.apartmentId))
        .filter((id) => id && !id.startsWith('db:') && !id.startsWith('stub:'))
    )],
  [locations]);
  const visibleIdsKey = visibleRealAptIds.join(',');

  useEffect(() => {
    const missing = visibleRealAptIds.filter((id) => !attemptedPhotoIdsRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => attemptedPhotoIdsRef.current.add(id));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(apiUrl('/api/accounts/apartment-photos/bulk'), {
          method: 'POST',
          body: JSON.stringify({ apartmentIds: missing }),
        });
        if (!res.ok || cancelled) return;
        const data   = await res.json().catch(() => ({}));
        const photos = data?.photos || {};
        const nonEmpty = {};
        Object.keys(photos).forEach((id) => {
          if (Array.isArray(photos[id]) && photos[id].length > 0) nonEmpty[id] = photos[id];
        });
        if (!cancelled && Object.keys(nonEmpty).length > 0) {
          setPhotoOverrides((prev) => ({ ...prev, ...nonEmpty }));
        }
      } catch { /* non-fatal — popups just fall back to "No photo yet" */ }
    })();
    return () => { cancelled = true; };
  }, [visibleIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useLeafletMap(mapContainerRef, mapPoints, markerMapRef, focusedAptId, mapStyle);
  useLeafletMap(modalMapContainerRef, mapPoints, modalMarkerMapRef, focusedAptId, mapStyle, isModalOpen);

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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingRight: 46 }}>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setTimeout(() => {
                if (modalMapContainerRef.current) {
                  window.dispatchEvent(new Event('resize'));
                }
              }, 350);
            }}
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
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            ⤢ Expand
          </button>

          {/* Dropdown 1 — Business Account */}
          <SearchableDropdown
            value={selectedClient}
            onChange={handleClientChange}
            disabled={isDropdownLoading}
            placeholder={isDropdownLoading ? 'Loading accounts…' : `All accounts (${clients.length})`}
            options={[
              { value: 'all', label: `All accounts (${clients.length})` },
              ...clients.map(c => ({ value: c.id, label: c.name })),
            ]}
          />

          {/* Dropdown 2 — Property */}
          {selectedClient !== 'all' && (
            <SearchableDropdown
              value={selectedPropIndex !== null ? String(selectedPropIndex) : ''}
              onChange={(v) => handlePropChange(v === '' ? null : Number(v))}
              disabled={isDropdownLoading || propertyOptions.length === 0}
              placeholder={propertyOptions.length === 0 ? 'No properties' : `All properties (${propertyOptions.length})`}
              options={[
                { value: '', label: `All properties (${propertyOptions.length})` },
                ...propertyOptions.map(p => ({ value: String(p.index), label: p.name })),
              ]}
            />
          )}

          {/* Dropdown 3 — Room */}
          {selectedClient !== 'all' && selectedPropIndex !== null && roomOptions.length > 0 && (
            <SearchableDropdown
              value={selectedAptId}
              onChange={(v) => {
                handleAptChange(v);
                if (v) {
                  const apt = smoobuApts.find(a => String(a.apartmentId) === v);
                  if (apt) { setSelectedLegendApt(apt); setActiveTab('detail'); }
                }
              }}
              disabled={aptLoading}
              placeholder={`All rooms (${roomOptions.length})`}
              options={[
                { value: '', label: `All rooms (${roomOptions.length})` },
                ...roomOptions.map(r => ({ value: r.id, label: r.hasCoord ? r.name : `${r.name} (no coords)` })),
              ]}
            />
          )}

        </div>
      </div>

      {/* ── Map + legend ──
          The map container is ALWAYS mounted (Leaflet inits once and keeps
          its size). While loading we lay a skeleton OVER it instead of
          unmounting it — this fixes the half-rendered / broken-tiles look. */}
      <div className="pm-map-wrapper" style={{ position: 'relative', display: 'flex', height: 410, overflow: 'hidden', borderRadius: '0 0 var(--radius-card, 12px) var(--radius-card, 12px)' }}>

          {/* Leaflet map container */}
          <div
            ref={mapContainerRef}
            className="pm-map-container"
            style={{ flex: 1, minWidth: 0, zIndex: 0, overflow: 'hidden', position: 'relative', WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}
          >
            {/* Map style switcher */}
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 1000,
              display: 'flex', borderRadius: 8, overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.18)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            }}>
              {Object.entries(MAP_STYLES).map(([key, val], i, arr) => (
                <button
                  key={key}
                  onClick={() => setMapStyle(key)}
                  style={{
                    padding: '4px 9px', fontSize: '11px', fontWeight: 600,
                    fontFamily: 'var(--font-body)', border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    background: mapStyle === key ? '#1a9e6e' : 'rgba(255,255,255,0.93)',
                    color: mapStyle === key ? '#fff' : '#374151',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >{val.label}</button>
              ))}
            </div>

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
          <div className="pm-legend-container" style={{
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
    {/* ── Full-screen modal ── */}
      {isModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
          className="pm-modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
          }}
        >
          <div className="pm-modal-inner" style={{
            background: 'var(--color-surface, #fff)',
            borderRadius: 16,
            width: '95vw', maxWidth: 1300,
            height: '92dvh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
          }}>
            {/* Modal header with ALL dropdowns */}
            <div className="pm-modal-head" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              flexWrap: 'wrap', gap: 10,
              minHeight: 56,
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--color-brand, #1a9e6e), #0d7a54)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0, color: 'white',
                }}>🗺</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, color: 'var(--color-text)' }}>
                    Property Map
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', lineHeight: 1.2 }}>
                    {statusText}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Dropdown 1 — Business Account */}
                <SearchableDropdown
                  value={selectedClient}
                  onChange={handleClientChange}
                  disabled={isDropdownLoading}
                  placeholder={isDropdownLoading ? 'Loading accounts…' : `All accounts (${clients.length})`}
                  options={[
                    { value: 'all', label: `All accounts (${clients.length})` },
                    ...clients.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />

                {/* Dropdown 2 — Property */}
                {selectedClient !== 'all' && (
                  <SearchableDropdown
                    value={selectedPropIndex !== null ? String(selectedPropIndex) : ''}
                    onChange={(v) => handlePropChange(v === '' ? null : Number(v))}
                    disabled={isDropdownLoading || propertyOptions.length === 0}
                    placeholder={propertyOptions.length === 0 ? 'No properties' : `All properties (${propertyOptions.length})`}
                    options={[
                      { value: '', label: `All properties (${propertyOptions.length})` },
                      ...propertyOptions.map(p => ({ value: String(p.index), label: p.name })),
                    ]}
                  />
                )}

                {/* Dropdown 3 — Room */}
                {selectedClient !== 'all' && selectedPropIndex !== null && roomOptions.length > 0 && (
                  <SearchableDropdown
                    value={selectedAptId}
                    onChange={(v) => {
                      handleAptChange(v);
                      if (v) {
                        const apt = smoobuApts.find(a => String(a.apartmentId) === v);
                        if (apt) { setSelectedLegendApt(apt); setActiveTab('detail'); }
                      }
                    }}
                    disabled={aptLoading}
                    placeholder={`All rooms (${roomOptions.length})`}
                    options={[
                      { value: '', label: `All rooms (${roomOptions.length})` },
                      ...roomOptions.map(r => ({ value: r.id, label: r.hasCoord ? r.name : `${r.name} (no coords)` })),
                    ]}
                  />
                )}

                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    position: 'absolute', top: 10, right: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    fontSize: '1rem', cursor: 'pointer',
                    color: 'var(--color-muted)', lineHeight: 1,
                    width: 34, height: 34, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                    zIndex: 20,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2, #f3f4f6)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface)'}
                >✕</button>
              </div>
            </div>

            {/* Modal map + legend + detail */}
            <div className="pm-modal-body" style={{ position: 'relative', display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
              <div
                ref={modalMapContainerRef}
                className="pm-modal-map"
                style={{ flex: 1, minWidth: 0, zIndex: 0, overflow: 'hidden', position: 'relative', WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}
              >
                {/* Map style switcher — top-right of map area */}
                <div style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 1000,
                  display: 'flex', borderRadius: 8, overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.18)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                }}>
                  {Object.entries(MAP_STYLES).map(([key, val], i, arr) => (
                    <button
                      key={key}
                      onClick={() => setMapStyle(key)}
                      style={{
                        padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                        fontFamily: 'var(--font-body)', border: 'none',
                        borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        background: mapStyle === key ? '#1a9e6e' : 'rgba(255,255,255,0.93)',
                        color: mapStyle === key ? '#fff' : '#374151',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >{val.label}</button>
                  ))}
                </div>

                {!isMapLoading && locations.length > 0 && plottable.length === 0 && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 20,
                  }}>
                    <div style={{ color: 'var(--color-muted)', fontSize: '.82rem', maxWidth: 300 }}>
                      {aptError
                        ? `Could not load Smoobu data: ${aptError}`
                        : "No map coordinates set for these properties yet."}
                    </div>
                  </div>
                )}
              </div>

              {/* Legend + Detail — tabbed */}
              <div className="pm-modal-panel" style={{
                width: 300, flexShrink: 0,
                borderLeft: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--color-surface, #fff)',
              }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                  <button
                    onClick={() => setActiveTab('properties')}
                    style={{
                      flex: 1, padding: '9px 4px', fontSize: '.72rem', fontWeight: 600,
                      fontFamily: 'var(--font-body)', border: 'none', cursor: 'pointer',
                      background: 'transparent',
                      color: activeTab === 'properties' ? 'var(--color-brand, #1a9e6e)' : 'var(--color-muted)',
                      borderBottom: activeTab === 'properties' ? '2px solid var(--color-brand, #1a9e6e)' : '2px solid transparent',
                      transition: 'color 0.15s',
                    }}
                  >
                    Properties <span style={{ fontSize: '.65rem', background: 'var(--color-surface-2,#f3f4f6)', borderRadius: 20, padding: '1px 6px', marginLeft: 4 }}>{locations.length}</span>
                  </button>
                  <button
                    onClick={() => { if (selectedLegendApt) setActiveTab('detail'); }}
                    disabled={!selectedLegendApt}
                    style={{
                      flex: 1, padding: '9px 4px', fontSize: '.72rem', fontWeight: 600,
                      fontFamily: 'var(--font-body)', border: 'none', cursor: selectedLegendApt ? 'pointer' : 'default',
                      background: 'transparent',
                      color: activeTab === 'detail' && selectedLegendApt ? 'var(--color-brand, #1a9e6e)' : 'var(--color-muted)',
                      borderBottom: activeTab === 'detail' && selectedLegendApt ? '2px solid var(--color-brand, #1a9e6e)' : '2px solid transparent',
                      opacity: selectedLegendApt ? 1 : 0.45,
                      transition: 'color 0.15s',
                    }}
                  >
                    Detail
                  </button>
                </div>

                {/* Properties tab */}
                {activeTab === 'properties' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '10px 8px' }}>
                    <input
                      placeholder="Search…"
                      value={legendSearch}
                      onChange={e => setLegendSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '5px 9px', marginBottom: 6,
                        border: '1px solid var(--color-border)',
                        borderRadius: 8, fontSize: '.72rem',
                        background: 'var(--color-surface-2,#f9fafb)',
                        color: 'var(--color-text)', outline: 'none',
                        fontFamily: 'var(--font-body)',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {locations
                        .filter(p => {
                          if (!legendSearch.trim()) return true;
                          const q = legendSearch.toLowerCase();
                          return (
                            (p.apartmentName || '').toLowerCase().includes(q) ||
                            (p.propertyName  || '').toLowerCase().includes(q) ||
                            (p.clientName    || '').toLowerCase().includes(q) ||
                            (p.city          || '').toLowerCase().includes(q)
                          );
                        })
                        .map((p) => {
                        const addrParts = [p.street, p.city, p.country].filter(Boolean);
                        const addr      = addrParts.join(', ');
                        const hasCoords = p.latitude !== null && p.longitude !== null &&
                                          Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
                        const dotColor  = hasCoords ? colorForId(p.apartmentId) : '#d1d5db';
                        const subtitle  = addr || p.type || (hasCoords ? '' : 'No address in Smoobu');
                        const isFocused = focusedAptId && String(p.apartmentId) === focusedAptId;
                        return (
                          <div
                            key={String(p.apartmentId)}
                            onClick={() => {
                              if (!hasCoords) return;
                              handleAptChange(String(p.apartmentId) === focusedAptId ? '' : String(p.apartmentId));
                              setSelectedLegendApt(prev => prev?.apartmentId === p.apartmentId ? null : p);
                              setActiveTab('detail');
                            }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 6,
                              cursor: hasCoords ? 'pointer' : 'default',
                              background: isFocused ? 'var(--color-brand-light, #e6f7f1)' : 'transparent',
                              borderRadius: 6, padding: '4px 4px', transition: 'background 0.15s',
                              outline: isFocused ? '1.5px solid var(--color-brand, #1a9e6e)' : 'none',
                            }}
                          >
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: dotColor, flexShrink: 0, marginTop: 4,
                              boxShadow: isFocused ? `0 0 0 2px ${dotColor}55` : 'none',
                            }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <div style={{
                                  fontSize: '.7rem', fontWeight: isFocused ? 700 : 600, lineHeight: 1.25,
                                  color: isFocused ? 'var(--color-brand)' : 'var(--color-text)',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                  {p.apartmentName || p.propertyName}
                                </div>
                                {p.type && (
                                  <span style={{ fontSize: '.58rem', padding: '1px 5px', borderRadius: 20, background: 'var(--color-surface-2,#f3f4f6)', color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {p.type}
                                  </span>
                                )}
                              </div>
                              {p.propertyName && p.apartmentName !== p.propertyName && (
                                <div style={{ fontSize: '.63rem', color: 'var(--color-muted)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.propertyName}
                                </div>
                              )}
                              <div style={{ fontSize: '.63rem', color: 'var(--color-brand)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.clientName}
                              </div>
                              <div style={{ fontSize: '.61rem', color: 'var(--color-muted)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {subtitle}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detail tab */}
                {activeTab === 'detail' && selectedLegendApt && (
                  <div style={{ width: '100%', overflowY: 'auto', flex: 1 }}>
                    {/* Hidden multi-file picker — triggered by the carousel's Add buttons */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => { handlePhotoFiles(e.target.files); e.target.value = ''; }}
                    />
                    {(imgLoading && !uploading) ? (
                      <div style={{
                        height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-surface-2, #f3f4f6)', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '.75rem', color: 'var(--color-muted)' }}>Loading photos…</span>
                      </div>
                    ) : (
                      <PhotoCarousel
                        images={detailImages}
                        altText={selectedLegendApt.apartmentName || selectedLegendApt.propertyName || ''}
                        canAdd={canAddPhoto}
                        uploading={uploading}
                        onAddPhoto={triggerAddPhoto}
                      />
                    )}
                    {uploadError && (
                      <div style={{ padding: '6px 14px 0', fontSize: '.7rem', color: '#c0392b' }}>
                        {uploadError}
                      </div>
                    )}
                    <div style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--color-text)', lineHeight: 1.3, marginBottom: 2 }}>
                            {selectedLegendApt.apartmentName || selectedLegendApt.propertyName}
                          </div>
                          {selectedLegendApt.propertyName && selectedLegendApt.apartmentName !== selectedLegendApt.propertyName && (
                            <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', marginBottom: 2 }}>
                              {selectedLegendApt.propertyName}
                            </div>
                          )}
                          <div style={{ fontSize: '.72rem', color: 'var(--color-brand)', fontWeight: 600 }}>
                            {selectedLegendApt.clientName}
                          </div>
                        </div>
                        <button onClick={() => { setSelectedLegendApt(null); setActiveTab('properties'); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '1rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-surface-2, #f9fafb)', borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: colorForId(selectedLegendApt.apartmentId) }} />
                        <span style={{ fontSize: '.7rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>ID: {selectedLegendApt.apartmentId}</span>
                      </div>

                      {(selectedLegendApt.street || selectedLegendApt.city) && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 5 }}>Address</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                            {[selectedLegendApt.street, selectedLegendApt.zip, selectedLegendApt.city, selectedLegendApt.country].filter(Boolean).join(', ')}
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 5 }}>Room Details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'Type',       value: selectedLegendApt.type },
                            { label: 'Max Guests', value: selectedLegendApt.maxOccupancy },
                            { label: 'Bedrooms',   value: selectedLegendApt.bedrooms },
                            { label: 'Bathrooms',  value: selectedLegendApt.bathrooms },
                            { label: 'Beds',       value: selectedLegendApt.beds },
                            { label: 'Size',       value: selectedLegendApt.squareMeters ? `${selectedLegendApt.squareMeters} m²` : null },
                          ].filter(d => d.value != null && d.value !== '').map(d => (
                            <div key={d.label} style={{ background: 'var(--color-surface-2, #f9fafb)', borderRadius: 7, padding: '7px 10px' }}>
                              <div style={{ fontSize: '.63rem', color: 'var(--color-muted)', marginBottom: 2 }}>{d.label}</div>
                              <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--color-text)' }}>{d.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedLegendApt.latitude != null && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 5 }}>Coordinates</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface-2, #f9fafb)', borderRadius: 7, padding: '7px 10px' }}>
                            <span style={{ fontSize: '.7rem', color: 'var(--color-text)', fontFamily: 'monospace' }}>
                              {Number(selectedLegendApt.latitude).toFixed(5)}, {Number(selectedLegendApt.longitude).toFixed(5)}
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(`${selectedLegendApt.latitude}, ${selectedLegendApt.longitude}`)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: 'var(--color-brand)', fontWeight: 600, padding: '2px 4px' }}>Copy</button>
                          </div>
                        </div>
                      )}

                      {selectedLegendApt.apartmentId && !String(selectedLegendApt.apartmentId).startsWith('db:') && (
                        <a href={`https://login.smoobu.com/en/cockpit/apartments/view/id/${selectedLegendApt.apartmentId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 0', background: 'var(--color-brand, #1a9e6e)', color: '#fff', borderRadius: 8, fontSize: '.78rem', fontWeight: 700, textDecoration: 'none', marginBottom: 6 }}>
                          View in Smoobu ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    <style>{`
      /* ── DESKTOP modal ── */
      @media (min-width: 769px) {
        .pm-modal-overlay {
          padding: 32px !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .pm-modal-inner {
          width: 88vw !important;
          max-width: 1200px !important;
          height: 86vh !important;
          border-radius: 16px !important;
          margin: 0 auto !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
        }
        .pm-modal-head {
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 20px !important;
          flex-shrink: 0 !important;
          flex-wrap: nowrap !important;
          min-height: 56px !important;
          gap: 12px !important;
        }
        .pm-modal-head > div:first-child {
          flex-shrink: 0 !important;
        }
        .pm-modal-head > div:last-child {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: nowrap !important;
          flex-shrink: 0 !important;
        }
        .pm-modal-body {
          flex-direction: row !important;
          flex: 1 !important;
          overflow: hidden !important;
          min-height: 0 !important;
          display: flex !important;
        }
        .pm-modal-map {
          flex: 1 !important;
          height: 100% !important;
          min-height: unset !important;
          min-width: 0 !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .pm-modal-panel {
          width: 300px !important;
          min-width: 300px !important;
          max-width: 300px !important;
          border-left: 1px solid var(--color-border) !important;
          border-top: none !important;
          height: 100% !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          flex-shrink: 0 !important;
        }
      }

      /* ── MOBILE modal ── */
      @media (max-width: 768px) {
        .db-table-card__head {
          flex-direction: column !important;
          align-items: flex-start !important;
          padding: 12px 14px !important;
          gap: 10px !important;
        }
        .db-table-card__head > div:last-child {
          width: 100% !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
        }
        .db-table-card__head > div:last-child select,
        .db-table-card__head > div:last-child button {
          flex: 1 !important;
          min-width: 120px !important;
          font-size: .72rem !important;
        }
        .pm-map-wrapper {
          flex-direction: column !important;
          height: auto !important;
        }
        .pm-map-container {
          height: 300px !important;
          min-height: 300px !important;
          width: 100% !important;
          flex: none !important;
        }
        .pm-legend-container {
          width: 100% !important;
          max-height: 240px !important;
          border-left: none !important;
          border-top: 1px solid var(--color-border) !important;
        }
        .pm-modal-overlay {
          padding: 0 !important;
          align-items: flex-end !important;
        }
        .pm-modal-inner {
          width: 100vw !important;
          height: calc(92dvh - env(safe-area-inset-bottom, 0px)) !important;
          max-width: 100vw !important;
          border-radius: 16px 16px 0 0 !important;
          margin: 0 !important;
        }
        .pm-modal-head {
          flex-direction: column !important;
          align-items: flex-start !important;
          padding: 10px 14px !important;
          gap: 8px !important;
        }
        .pm-modal-head > div:last-child {
          width: 100% !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
        }
        .pm-modal-head > div:last-child select,
        .pm-modal-head > div:last-child button {
          flex: 1 !important;
          min-width: 100px !important;
          font-size: .72rem !important;
        }
        .pm-modal-body {
          flex-direction: column !important;
          overflow-y: auto !important;
        }
        .pm-modal-map {
          height: 300px !important;
          min-height: 300px !important;
          flex: none !important;
          width: 100% !important;
        }
        .pm-modal-panel {
          width: 100% !important;
          border-left: none !important;
          border-top: 1px solid var(--color-border) !important;
          min-height: 280px !important;
          flex: 1 !important;
        }
      }
    `}</style>
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

// ── Searchable custom dropdown ────────────────────────────────────
function SearchableDropdown({ value, onChange, options, placeholder, disabled, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <div
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px 6px 12px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--color-border)',
          background: value && value !== 'all' && value !== '' ? '#f0fdf4' : 'var(--color-surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '.78rem', fontWeight: 600,
          color: disabled ? 'var(--color-muted)' : (value && value !== 'all' && value !== '' ? '#059669' : 'var(--color-text)'),
          userSelect: 'none', whiteSpace: 'nowrap',
          maxWidth: 200, minWidth: 100,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          zIndex: 9000, background: '#fff',
          border: '1.5px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 200, maxWidth: 280,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 10px', borderRadius: 6,
                border: '1.5px solid #e2e8f0', fontSize: '.78rem',
                outline: 'none', background: '#fafafa',
                fontFamily: 'var(--font-body)',
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: '.83rem',
                  background: value === o.value ? '#f0fdf4' : 'transparent',
                  color: value === o.value ? '#059669' : '#374151',
                  fontWeight: value === o.value ? 600 : 400,
                  borderBottom: '1px solid #f7f7f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = '#f8faf9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = value === o.value ? '#f0fdf4' : 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {value === o.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="2,6 5,9 10,3"/>
                  </svg>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: '.78rem', color: '#a0aec0', textAlign: 'center' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}