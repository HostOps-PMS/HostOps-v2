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
//   1. GET /apartments                              → list of IDs + names
//   2. GET /apartments/{id}                         → detail: coords, rooms, type
//   3. GET /en/website-external/apartment/{id}      → HTML scrape for photos
//      Smoobu's REST API has NO images endpoint. Photos are only available on
//      the public apartment page as <img src="/upload/images/..."> tags.
// ─────────────────────────────────────────────────────────────────

import { Router }  from 'express';
import User        from '../models/user.js';
import { decrypt } from '../utils/encryption.js';

const router = Router();

const SMOOBU_BASE     = 'https://login.smoobu.com/api';
const SMOOBU_WEB_BASE = 'https://login.smoobu.com';

// ── In-process cache ──────────────────────────────────────────────
// API responses: 60 s TTL.  Image scrapes: 10 min TTL (rarely change).
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

// ── Smoobu REST API fetch ─────────────────────────────────────────
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

// ── Step 3: scrape images from Smoobu's public apartment page ─────
//
// The page at https://login.smoobu.com/en/website-external/apartment/{id}
// renders all uploaded photos as <img src="/upload/images/.../thumb_xxx.jpg">.
// We fetch the HTML, extract every unique /upload/images/ path, strip the
// "thumb_" prefix to get the full-resolution URL, and return the array.
// Cached per apartment for 10 minutes — images rarely change.
async function scrapeApartmentImages(aptId) {
  const cacheKey = `scrape:apt:${aptId}`;
  const cached = _getCache(cacheKey);
  if (cached) return cached;

  const url = `${SMOOBU_WEB_BASE}/en/website-external/apartment/${aptId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HostPilot/1.0)',
        'Accept':     'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      console.warn(`[smoobuApartments] scrape apt ${aptId} → HTTP ${res.status}`);
      _setCache(cacheKey, [], 10 * 60_000);
      return [];
    }

    const html = await res.text();

    // Match all src="/upload/images/..." (single or double quotes)
    const srcRegex = /src=["'](\/?upload\/images\/[^"']+)["']/gi;
    const seen   = new Set();
    const images = [];
    let match;

    while ((match = srcRegex.exec(html)) !== null) {
      let path = match[1];

      // Ensure absolute URL
      if (!path.startsWith('http')) {
        path = `${SMOOBU_WEB_BASE}/${path.replace(/^\//, '')}`;
      }

      // Strip "thumb_" prefix → full-resolution file.
      // Smoobu stores: /upload/images/.../thumb_<hash>.jpg  (thumbnail shown in UI)
      //                /upload/images/.../<hash>.jpg         (full-res)
      const fullPath = path.replace(/\/thumb_([^/]+)$/, '/$1');

      if (!seen.has(fullPath)) {
        seen.add(fullPath);
        images.push({ id: null, url: fullPath });
      }
    }

    console.log(`[smoobuApartments] scrape apt ${aptId} → ${images.length} images found`);
    _setCache(cacheKey, images, 10 * 60_000);
    return images;
  } catch (err) {
    console.warn(`[smoobuApartments] scrape apt ${aptId} failed:`, err.message);
    _setCache(cacheKey, [], 10 * 60_000);
    return [];
  }
}

// ── Main fetch: list + detail + image scrape per apartment ────────
async function fetchApartmentsForKey(apiKey, propId, propertyName, clientId, clientName) {
  // Step 1 — GET /apartments (list of IDs + names)
  const listData = await smoobuGet('/apartments', apiKey, `${propId}:/apartments`);
  const aptList  = listData?.apartments ?? [];
  console.log(`[smoobuApartments] property="${propertyName}" → ${aptList.length} apartments`);

  const results = await Promise.all(
    aptList.map(async (apt) => {
      const aptId = apt.id ?? apt;

      // Steps 2 + 3 in parallel — API detail and HTML image scrape
      const [detailResult, imagesResult] = await Promise.allSettled([
        smoobuGet(`/apartments/${aptId}`, apiKey, `${propId}:/apartments/${aptId}`),
        scrapeApartmentImages(aptId),
      ]);

      const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
      const images = imagesResult.status  === 'fulfilled' ? imagesResult.value  : [];

      if (detailResult.status === 'rejected') {
        console.warn(`[smoobuApartments] detail failed apt ${aptId}:`, detailResult.reason?.message);
      }

      const loc = detail?.location || {};

      console.log(`[smoobuApartments] apt ${aptId} "${apt.name}" → images=${images.length}`);

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

    const withCoords  = allApartments.filter(a => a.latitude  !== null && a.longitude !== null).length;
    const withImages  = allApartments.filter(a => a.images?.length > 0).length;
    console.log(`[smoobuApartments] client=${clientId} → ${allApartments.length} apts (${withCoords} with coords, ${withImages} with images)`);

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