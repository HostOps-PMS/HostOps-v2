// src/routes/imageProxy.js
//
// ── What this does ───────────────────────────────────────────────
// Proxies property images through the backend so the real Cloudinary
// URL is NEVER exposed to the client. The browser only ever sees:
//
//   GET /api/image/property/:userId/:propertyId
//
// NO AUTH required on this route intentionally — <img> tags cannot
// send Authorization headers. Security comes from the URL itself:
//   - userId + propertyId must be valid MongoDB ObjectIds in our DB
//   - Only Cloudinary URLs are proxied (whitelist enforced)
//   - URLs are never guessable without prior knowledge of the IDs
// ─────────────────────────────────────────────────────────────────

import express from 'express';
import https   from 'https';
import http    from 'http';
import { URL } from 'url';
import User    from '../models/user.js';

const router = express.Router();

// ── In-memory cache ───────────────────────────────────────────────
// key: `${userId}:${propertyId}` → Cloudinary URL
// TTL: 5 minutes. Invalidated on picture upload via invalidateImageCache().
const urlCache  = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
  const entry = urlCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { urlCache.delete(key); return null; }
  return entry.url;
}

function cacheSet(key, url) {
  urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL });
}

export function invalidateImageCache(userId, propertyId) {
  urlCache.delete(`${userId}:${propertyId}`);
}

// ── Cloudinary hostname whitelist ─────────────────────────────────
// Never proxy to arbitrary URLs — Cloudinary only.
const ALLOWED_HOSTS = ['res.cloudinary.com'];

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// ── GET /api/image/property/:userId/:propertyId ───────────────────
// No requireAuth — <img> tags cannot send Bearer tokens.
// Security: only serves images that exist in our DB for valid IDs.
router.get('/image/property/:userId/:propertyId', async (req, res, next) => {
  try {
    const { userId, propertyId } = req.params;

    // Basic ObjectId format check — reject obviously invalid IDs early
    if (!/^[a-f\d]{24}$/i.test(userId) || !/^[a-f\d]{24}$/i.test(propertyId)) {
      return res.status(400).end();
    }

    // ── Cache lookup ──────────────────────────────────────────────
    const cacheKey = `${userId}:${propertyId}`;
    let cloudinaryUrl = cacheGet(cacheKey);

    // ── DB lookup if cache miss ───────────────────────────────────
    if (!cloudinaryUrl) {
      const user = await User.findById(userId).select('properties');
      if (!user) return res.status(404).end();

      const property = (user.properties || []).find(
        p => String(p._id) === propertyId
      );
      if (!property?.propertyPicture) return res.status(404).end();

      cloudinaryUrl = property.propertyPicture;
      cacheSet(cacheKey, cloudinaryUrl);
    }

    // ── Whitelist check ───────────────────────────────────────────
    if (!isAllowedUrl(cloudinaryUrl)) {
      console.error('[imageProxy] Blocked non-Cloudinary URL:', cloudinaryUrl);
      return res.status(502).end();
    }

    // ── Proxy the image ───────────────────────────────────────────
    const parsed   = new URL(cloudinaryUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;

    const proxyReq = protocol.get(cloudinaryUrl, (proxyRes) => {
      const contentType   = proxyRes.headers['content-type'] || 'image/jpeg';
      const contentLength = proxyRes.headers['content-length'];

      // Block non-image responses (e.g. Cloudinary error HTML pages)
      if (!contentType.startsWith('image/')) {
        console.error('[imageProxy] Non-image content-type:', contentType);
        if (!res.headersSent) res.status(502).end();
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 min browser cache
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[imageProxy] Fetch error:', err.message);
      if (!res.headersSent) res.status(502).end();
    });

    res.on('close', () => proxyReq.destroy());

  } catch (err) { next(err); }
});

export default router;