// routes/smoobuApartments.js
// ─────────────────────────────────────────────────────────────────
// GET /api/accounts/:clientId/smoobu-apartments
//
// Returns all Smoobu sub-apartments (rooms/units) for a client's
// DB-stored property (or all properties when no propertyIndex given).
//
// Query params:
//   propertyIndex  (optional) — 0-based index into client.properties[].
//                               Omit to fetch ALL properties for this client.
//
// Smoobu API strategy:
//   1. GET /apartments          → list with images[] on EACH apartment object
//   2. GET /apartments/{id}     → detail with location (lat/lng), rooms, type
//
// Images come from step 1 (the list). Step 2 adds coords + room details.
// We merge both so the response has everything.
// ─────────────────────────────────────────────────────────────────

import { Router }  from 'express';
import User        from '../models/user.js';
import { decrypt } from '../utils/encryption.js';

const router = Router();

const SMOOBU_BASE = 'https://login.smoobu.com/api';

// ── In-process cache (same TTL pattern as smoobu.js) ──────────────
const _cache = new Map();
function _getCache(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { _cache.delete(key); return null; }
  return hit.data;
}
function _setCache(key, data, ttlMs = 60_000) {
  _cache.set(key, { data, exp: Date.now() + ttlMs });
}

// ── Direct Smoobu fetch (bypasses smoobu.js so we get the FULL response) ──────
async function smoobuGet(path, apiKey, cacheKey) {
  const cached = _getCache(cacheKey);
  if (cached) return cached;

  const res = await fetch(SMOOBU_BASE + path, {
    headers: { 'Api-Key': apiKey, 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Smoobu ${res.status} ${path}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  _setCache(cacheKey, data);
  return data;
}

// ── Helper: parse coord strings ───────────────────────────────────
function toCoord(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

// ── Helper: extract images from ANY Smoobu response shape ─────────
// Smoobu returns images on the detail endpoint. Field names vary by API version.
// We try every known path exhaustively and log what we find.
function extractImages(obj) {
  if (!obj) return [];

  // ── Unwrap nested shapes ──────────────────────────────────────────
  // Some Smoobu API versions nest the apartment inside obj.apartment
  const target = obj.apartment ?? obj;

  // ── Try every known field name ────────────────────────────────────
  const raw = Array.isArray(target.images)      ? target.images
            : Array.isArray(target.pictures)    ? target.pictures
            : Array.isArray(target.photos)      ? target.photos
            : Array.isArray(target.media)       ? target.media
            : Array.isArray(target.gallery)     ? target.gallery
            : Array.isArray(target.attachments) ? target.attachments
            : null;

  if (!raw) return [];

  return raw
    .filter((img) => img != null)
    .map((img) => {
      // Plain URL string
      if (typeof img === 'string' && img.trim())
        return { id: null, url: img.trim() };
      // Object with .url
      if (img && typeof img.url === 'string' && img.url.trim())
        return { id: img.id ?? null, url: img.url.trim() };
      // Object with .image
      if (img && typeof img.image === 'string' && img.image.trim())
        return { id: img.id ?? null, url: img.image.trim() };
      // Object with .src
      if (img && typeof img.src === 'string' && img.src.trim())
        return { id: img.id ?? null, url: img.src.trim() };
      // Object with .link
      if (img && typeof img.link === 'string' && img.link.trim())
        return { id: img.id ?? null, url: img.link.trim() };
      return null;
    })
    .filter(Boolean);
}

// ── Main fetch: list + detail per apartment ───────────────────────
async function fetchApartmentsForKey(apiKey, propId, propertyName, clientId, clientName) {
  // Step 1 — GET /apartments (list)
  const listData = await smoobuGet('/apartments', apiKey, `${propId}:/apartments`);

  // Log the FULL raw shape of the first apartment in the list
  const firstApt = (listData?.apartments ?? [])[0];
  if (firstApt) {
    console.log(`[smoobuApartments] LIST apt ALL keys:`, Object.keys(firstApt));
    // Log every array-valued key so we can spot the images field no matter its name
    const arrayKeys = Object.keys(firstApt).filter(k => Array.isArray(firstApt[k]));
    console.log(`[smoobuApartments] LIST apt array-keys:`, arrayKeys);
    arrayKeys.forEach(k => {
      console.log(`[smoobuApartments]   LIST apt.${k}[0]:`, JSON.stringify(firstApt[k][0]).slice(0, 200));
    });
  }

  const aptList = listData?.apartments ?? [];
  console.log(`[smoobuApartments] property="${propertyName}" → ${aptList.length} apartments from list`);

  const results = await Promise.all(
    aptList.map(async (apt) => {
      const aptId = apt.id ?? apt;

      // Images from the LIST endpoint (usually absent, but check anyway)
      const listImages = extractImages(apt);

      try {
        // Step 2 — GET /apartments/{id}: adds location, rooms, type, AND images
        const detail = await smoobuGet(
          `/apartments/${aptId}`,
          apiKey,
          `${propId}:/apartments/${aptId}`
        );

        // Log the FULL raw shape of the detail response — ONCE per apartment type
        console.log(`[smoobuApartments]   detail apt ${aptId} ALL keys:`, Object.keys(detail || {}));
        const detailArrayKeys = Object.keys(detail || {}).filter(k => Array.isArray(detail[k]));
        console.log(`[smoobuApartments]   detail apt ${aptId} array-keys:`, detailArrayKeys);
        detailArrayKeys.forEach(k => {
          console.log(`[smoobuApartments]   detail apt.${k}[0]:`, JSON.stringify((detail[k] || [])[0]).slice(0, 200));
        });
        // Also check if there's a nested .apartment sub-object
        if (detail?.apartment) {
          console.log(`[smoobuApartments]   detail.apartment keys:`, Object.keys(detail.apartment));
          const nestedArrayKeys = Object.keys(detail.apartment).filter(k => Array.isArray(detail.apartment[k]));
          console.log(`[smoobuApartments]   detail.apartment array-keys:`, nestedArrayKeys);
        }

        const detailImages = extractImages(detail);

        // Prefer list images if present; otherwise use detail images
        const images = listImages.length > 0 ? listImages : detailImages;

        console.log(`[smoobuApartments]   apt ${aptId} "${apt.name || detail?.name}" → listImgs=${listImages.length} detailImgs=${detailImages.length} using=${images.length}`);

        const loc = detail?.location || {};

        return {
          apartmentId:   aptId,
          apartmentName: apt.name || detail?.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street:    loc.street  || '',
          zip:       loc.zip     || '',
          city:      loc.city    || '',
          country:   loc.country || '',
          latitude:  toCoord(loc.latitude),
          longitude: toCoord(loc.longitude),
          timeZone:     detail?.timeZone || null,
          currency:     detail?.currency || null,
          maxOccupancy: detail?.rooms?.maxOccupancy ?? null,
          bedrooms:     detail?.rooms?.bedrooms     ?? null,
          bathrooms:    detail?.rooms?.bathrooms    ?? null,
          type:         detail?.type?.name          || null,
          images,
        };
      } catch (detailErr) {
        console.warn(`[smoobuApartments] detail failed apt ${aptId}:`, detailErr.message);
        return {
          apartmentId:   aptId,
          apartmentName: apt.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
          timeZone: null, currency: null,
          maxOccupancy: null, bedrooms: null, bathrooms: null, type: null,
          images: listImages,
          fetchError: detailErr.message,
        };
      }
    })
  );

  return results;
}

// ── Route ─────────────────────────────────────────────────────────
router.get('/:clientId/smoobu-apartments', async (req, res) => {
  try {
    const { clientId }      = req.params;
    const { propertyIndex } = req.query;

    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'team_leader')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const client = await User.findById(clientId)
      .select('businessName firstName lastName email properties')
      .lean();

    if (!client) return res.status(404).json({ error: 'Client not found' });

    const clientName = client.businessName ||
      [client.firstName, client.lastName].filter(Boolean).join(' ') ||
      client.email;

    const allProps = Array.isArray(client.properties) ? client.properties : [];

    let propsToQuery = [];
    if (propertyIndex !== undefined && propertyIndex !== null && propertyIndex !== '') {
      const idx = parseInt(propertyIndex, 10);
      if (isNaN(idx) || idx < 0 || idx >= allProps.length) {
        return res.status(400).json({
          error: `propertyIndex ${propertyIndex} is out of range (0–${allProps.length - 1})`,
        });
      }
      propsToQuery = [{ prop: allProps[idx], propName: allProps[idx].propertyName || `Property ${idx + 1}` }];
    } else {
      propsToQuery = allProps.map((prop, i) => ({
        prop,
        propName: prop.propertyName || `Property ${i + 1}`,
      }));
    }

    const allApartments = [];

    await Promise.all(
      propsToQuery.map(async ({ prop, propName }) => {
        if (!prop.smoobuApiKey?.trim()) {
          console.warn(`[smoobuApartments] "${propName}" has no API key — skipping`);
          return;
        }

        let decryptedKey = '';
        try {
          decryptedKey = (decrypt(prop.smoobuApiKey) || '').trim();
        } catch (e) {
          console.warn(`[smoobuApartments] decrypt failed for "${propName}":`, e.message);
          return;
        }

        if (!decryptedKey) {
          console.warn(`[smoobuApartments] empty key after decrypt for "${propName}" — skipping`);
          return;
        }

        try {
          const apts = await fetchApartmentsForKey(
            decryptedKey,
            String(prop._id),
            propName,
            String(clientId),
            clientName
          );
          allApartments.push(...apts);
        } catch (fetchErr) {
          console.warn(`[smoobuApartments] fetch failed for "${propName}":`, fetchErr.message);
          allApartments.push({
            apartmentId:   `stub:${String(prop._id)}`,
            apartmentName: propName,
            propertyName:  propName,
            clientId:      String(clientId),
            clientName,
            street: '', zip: '', city: '', country: '',
            latitude: null, longitude: null,
            timeZone: null, currency: null,
            maxOccupancy: null, bedrooms: null, bathrooms: null, type: null,
            images: [],
            fetchError: fetchErr.message,
          });
        }
      })
    );

    const withCoords = allApartments.filter(a => a.latitude !== null && a.longitude !== null).length;
    const withImages = allApartments.filter(a => a.images?.length > 0).length;
    console.log(`[smoobuApartments] client=${clientId} → ${allApartments.length} apts (${withCoords} coords, ${withImages} with images)`);

    return res.json({
      allApartments,
      propertyCount: propsToQuery.length,
      totalFound:    allApartments.length,
    });

  } catch (err) {
    console.error('[smoobuApartments] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;