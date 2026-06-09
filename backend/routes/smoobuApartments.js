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
// IMPORTANT (confirmed against docs.smoobu.com, 2026): Smoobu's REST API has
// NO images/photos/pictures endpoint — not on GET /apartments and not on
// GET /apartments/{id}. The ONLY place photos exist is the public page:
//   https://login.smoobu.com/{locale}/website-external/apartment/{id}
// …and ONLY when that apartment is published on a Smoobu booking website.
//
// The old scraper matched only  src="/upload/images/..."  which missed
// lazy-loaded (data-src), responsive (srcset), CSS background-image, absolute
// CDN URLs, and JSON-embedded URLs — the most likely reason every apt was 0.
// This version extracts from all of those, tries multiple locale URLs, and
// logs a DIAGNOSTIC when it still finds nothing so the real cause is visible
// in the logs. Cached per apartment for 10 minutes — images rarely change.

// Broadly extract every plausible Smoobu photo URL from a page's HTML.
function extractSmoobuImageUrls(html, baseHost = SMOOBU_WEB_BASE) {
  const found = new Set();

  const pushUrl = (raw) => {
    if (!raw) return;
    let u = String(raw).trim().replace(/&amp;/g, '&');
    if (!u || u.startsWith('data:')) return;
    u = u.replace(/\\\//g, '/'); // unescape JSON slashes
    if (u.startsWith('//'))      u = 'https:' + u;
    else if (u.startsWith('/'))  u = baseHost + u;
    else if (!/^https?:\/\//i.test(u)) u = `${baseHost}/${u.replace(/^\.?\//, '')}`;

    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u)) return;
    if (/(sprite|logo|icon|placeholder|spinner|blank|flag)/i.test(u)) return;

    const isSmoobuPhoto = /\/upload\/images\//i.test(u) || /smoobu/i.test(u);
    if (!isSmoobuPhoto) return;

    u = u.replace(/\/thumb_([^/]+)$/i, '/$1'); // full-resolution
    found.add(u);
  };

  let m;
  const attrRe = /(?:src|data-src|data-original|data-lazy|data-lazy-src|data-image)\s*=\s*["']([^"']+)["']/gi;
  while ((m = attrRe.exec(html)) !== null) pushUrl(m[1]);

  const srcsetRe = /srcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    m[1].split(',').forEach((cand) => pushUrl(cand.trim().split(/\s+/)[0]));
  }

  const bgRe = /background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = bgRe.exec(html)) !== null) pushUrl(m[1]);

  const jsonRe = /https?:\\?\/\\?\/[^"'\\) ]*\/upload\/images\/[^"'\\) ]+/gi;
  while ((m = jsonRe.exec(html)) !== null) pushUrl(m[0]);

  return Array.from(found).map((url) => ({ id: null, url }));
}

async function scrapeApartmentImages(aptId) {
  const cacheKey = `scrape:apt:${aptId}`;
  const cached = _getCache(cacheKey);
  if (cached) return cached;

  const candidateUrls = [
    `${SMOOBU_WEB_BASE}/en/website-external/apartment/${aptId}`,
    `${SMOOBU_WEB_BASE}/de/website-external/apartment/${aptId}`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HostPilot/1.0)',
          'Accept':     'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) {
        console.warn(`[smoobuApartments] scrape apt ${aptId} ${url} → HTTP ${res.status}`);
        continue;
      }

      const html   = await res.text();
      const images = extractSmoobuImageUrls(html);

      if (images.length > 0) {
        console.log(`[smoobuApartments] scrape apt ${aptId} → ${images.length} images found (${url})`);
        _setCache(cacheKey, images, 10 * 60_000);
        return images;
      }

      // DIAGNOSTIC — zero images: describe the page so we can see WHY.
      console.warn(
        `[smoobuApartments] scrape apt ${aptId} → 0 images. ` +
        `url=${url} finalUrl=${res.url} htmlLen=${html.length} ` +
        `hasImgTag=${/<img/i.test(html)} hasUpload=${html.includes('/upload/images/')} ` +
        `hasSmoobuCdn=${/smoobu[^"']*\.(jpe?g|png|webp)/i.test(html)} ` +
        `looksLikeLogin=${/login|sign in|anmelden/i.test(html.slice(0, 4000))}`
      );
    } catch (err) {
      console.warn(`[smoobuApartments] scrape apt ${aptId} ${url} failed:`, err.message);
    }
  }

  _setCache(cacheKey, [], 10 * 60_000);
  return [];
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