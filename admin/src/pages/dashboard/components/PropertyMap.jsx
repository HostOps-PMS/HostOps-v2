// src/pages/Dashboard/components/PropertyMap.jsx
// ─────────────────────────────────────────────────────────────────
// Renders all client properties on a Leaflet map using the exact
// coordinates stored in Smoobu (/apartments/:id → location.latitude
// / location.longitude).
//
// Props:
//   mapLocations  — array from overview.mapLocations (may be null while loading)
//   loading       — boolean
//
// Each mapLocation item:
//   { id, name, propertyName, clientId, clientName,
//     address, street, zip, city, country, lat, lng }
//
// Falls back to a "No location data" empty state if Smoobu returned
// no coordinates for any apartment.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

// ── Leaflet is loaded via CDN in index.html ───────────────────────
// Make sure your index.html includes:
//   <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
//   <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

const DEFAULT_CENTER = [12.8797, 121.7740]; // Philippines center
const DEFAULT_ZOOM   = 6;

// Group color palette — one color per unique clientId
const CLIENT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#14b8a6',
];

function getClientColor(clientId, colorMap) {
  if (!colorMap.has(clientId)) {
    colorMap.set(clientId, CLIENT_COLORS[colorMap.size % CLIENT_COLORS.length]);
  }
  return colorMap.get(clientId);
}

function buildIcon(color) {
  const L = window.L;
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 28px; height: 28px;
        background: ${color};
        border: 3px solid #fff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,.35);
      "></div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 28],
    popupAnchor:[0, -30],
  });
}

// ── Skeleton loader ───────────────────────────────────────────────
function MapSkeleton() {
  return (
    <div style={{
      height: '100%',
      background: 'var(--color-surface-2, #1e2530)',
      borderRadius: 'var(--radius-md, 12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 12,
      color: 'var(--color-muted, #6b7280)',
      fontSize: '.85rem',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid var(--color-border, #2d3748)',
        borderTopColor: 'var(--color-primary, #3b82f6)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <span>Loading map…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
function EmptyMap() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 10,
      color: 'var(--color-muted, #6b7280)',
      fontSize: '.85rem',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <span>No map coordinates available yet.</span>
      <span style={{ fontSize: '.75rem', opacity: .6 }}>
        Add a location to your Smoobu properties to see them here.
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function PropertyMap({ mapLocations, loading }) {
  const mapRef      = useRef(null);   // DOM node
  const leafletRef  = useRef(null);   // L.Map instance
  const markersRef  = useRef([]);
  const colorMapRef = useRef(new Map());

  const [ready, setReady] = useState(false);

  // ── Init Leaflet once the DOM node is available ───────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const L = window.L;
    if (!L) {
      console.error('[PropertyMap] Leaflet not found. Make sure leaflet.js is loaded in index.html.');
      return;
    }

    const map = L.map(mapRef.current, {
      center:    DEFAULT_CENTER,
      zoom:      DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // ── Tile layer: OpenStreetMap (free, no API key needed) ─────
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletRef.current = map;
    setReady(true);

    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // ── Add / refresh markers whenever mapLocations changes ──────
  useEffect(() => {
    const L   = window.L;
    const map = leafletRef.current;
    if (!L || !map || !ready) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const locations = Array.isArray(mapLocations) ? mapLocations : [];
    const valid     = locations.filter(loc => loc.lat !== null && loc.lng !== null);

    if (valid.length === 0) return;

    const bounds = [];

    valid.forEach(loc => {
      const color  = getClientColor(loc.clientId, colorMapRef.current);
      const icon   = buildIcon(color);
      const latlng = [loc.lat, loc.lng];

      const popup = L.popup({ maxWidth: 260, className: 'pm-popup' }).setContent(`
        <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${loc.name}</div>
          <div style="color:#6b7280;margin-bottom:6px">${loc.propertyName}</div>
          ${loc.address
            ? `<div style="display:flex;gap:6px;align-items:flex-start">
                 <span style="margin-top:1px">📍</span>
                 <span>${loc.address}</span>
               </div>`
            : ''}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;
                      color:#6b7280;font-size:11px">
            Client: <strong style="color:#111">${loc.clientName}</strong>
          </div>
          <div style="margin-top:4px;color:#9ca3af;font-size:10px">
            ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}
          </div>
        </div>
      `);

      const marker = L.marker(latlng, { icon }).addTo(map).bindPopup(popup);
      markersRef.current.push(marker);
      bounds.push(latlng);
    });

    // Fit map to all markers (with padding)
    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
  }, [mapLocations, ready]);

  // ── Legend: one row per unique client ────────────────────────
  const legend = (() => {
    const seen = new Map();
    (Array.isArray(mapLocations) ? mapLocations : []).forEach(loc => {
      if (!seen.has(loc.clientId)) {
        seen.set(loc.clientId, {
          clientName: loc.clientName,
          color: getClientColor(loc.clientId, colorMapRef.current),
          count: 0,
        });
      }
      seen.get(loc.clientId).count += 1;
    });
    return [...seen.values()];
  })();

  const validCount = (Array.isArray(mapLocations) ? mapLocations : [])
    .filter(l => l.lat !== null && l.lng !== null).length;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      background:   'var(--color-surface, #131920)',
      border:       '1px solid var(--color-border, #2d3748)',
      borderRadius: 'var(--radius-md, 12px)',
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
      height:       420,
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding:    '14px 18px 10px',
        borderBottom:'1px solid var(--color-border, #2d3748)',
        display:    'flex',
        alignItems: 'center',
        justifyContent:'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h3 style={{ margin:0, fontSize:'.95rem', fontWeight:600,
                       color:'var(--color-text, #f1f5f9)' }}>
            Property Map
          </h3>
          <p style={{ margin:0, fontSize:'.72rem',
                      color:'var(--color-muted, #6b7280)', marginTop:2 }}>
            {loading
              ? 'Fetching coordinates from Smoobu…'
              : validCount > 0
                ? `${validCount} propert${validCount === 1 ? 'y' : 'ies'} plotted from Smoobu location data`
                : 'No Smoobu coordinates found'}
          </p>
        </div>

        {/* Source badge */}
        {!loading && validCount > 0 && (
          <div style={{
            fontSize:'.68rem', fontWeight:600, letterSpacing:'.04em',
            color:'#10b981', background:'rgba(16,185,129,.12)',
            border:'1px solid rgba(16,185,129,.3)',
            borderRadius:20, padding:'3px 10px',
          }}>
            SMOOBU GPS
          </div>
        )}
      </div>

      {/* ── Map area ───────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading ? (
          <MapSkeleton />
        ) : validCount === 0 ? (
          <EmptyMap />
        ) : (
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────── */}
      {!loading && legend.length > 0 && (
        <div style={{
          padding:    '10px 18px',
          borderTop:  '1px solid var(--color-border, #2d3748)',
          display:    'flex',
          flexWrap:   'wrap',
          gap:        '8px 16px',
          flexShrink: 0,
          background: 'var(--color-surface-2, #1a2232)',
        }}>
          {legend.map(entry => (
            <div key={entry.clientName} style={{
              display:    'flex',
              alignItems: 'center',
              gap:        6,
              fontSize:   '.72rem',
              color:      'var(--color-muted, #9ca3af)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: entry.color, flexShrink: 0,
              }} />
              <span>{entry.clientName}</span>
              <span style={{ opacity: .5 }}>({entry.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}