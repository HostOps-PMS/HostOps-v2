// src/routes/imageProxy.js
//
// ── What this does ───────────────────────────────────────────────
// Proxies property images through the backend so the real Cloudinary
// URL is NEVER exposed to the client. The browser only ever sees:
//
//   GET /api/image/property/:userId/:propertyId
//
// The actual Cloudinary URL is looked up server-side from the DB,
// fetched, and streamed back to the client. DevTools will only show
// your own API domain — no cloud name, no folder structure, nothing.
//
// ── Usage in sanitizeUser() ──────────────────────────────────────
// Replace propertyPicture with the proxy URL when building responses:
//
//   propertyPicture: buildProxyUrl(req, p._id, user._id)
//
// See sanitizeUser() in auth/routes/auth.js for the full integration.
// ─────────────────────────────────────────────────────────────────

import express        from 'express';
import https          from 'https';
import http           from 'http';
import { URL }        from 'url';
import User           from '../models/user.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── Cache: avoid hitting MongoDB on every image request ──────────
// Simple in-memory map: `${userId}:${propertyId}` → Cloudinary URL
// TTL: 5 minutes (images don't change often; upload invalidates cache)
const urlCache    = new Map();
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes

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

// ── Allowed Cloudinary hostname whitelist ─────────────────────────
// Only proxy requests to Cloudinary — never to arbitrary URLs.
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
// requireAuth: only logged-in users can fetch images.
// This prevents unauthenticated hotlinking even through the proxy.
router.get('/image/property/:userId/:propertyId', requireAuth, async (req, res, next) => {
  try {
    const { userId, propertyId } = req.params;

    // ── 1. Authorization check ────────────────────────────────────
    // Staff can only fetch images belonging to their client.
    // Regular users can only fetch their own images.
    const requesterId = req.isStaff
      ? String(req.staff.clientId)
      : String(req.user._id);

    if (requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── 2. Cache lookup ───────────────────────────────────────────
    const cacheKey  = `${userId}:${propertyId}`;
    let cloudinaryUrl = cacheGet(cacheKey);

    // ── 3. DB lookup if cache miss ────────────────────────────────
    if (!cloudinaryUrl) {
      const user = await User.findById(userId).select('properties');
      if (!user) return res.status(404).json({ error: 'User not found' });

      const property = (user.properties || []).find(
        p => String(p._id) === propertyId
      );
      if (!property) return res.status(404).json({ error: 'Property not found' });

      cloudinaryUrl = property.propertyPicture;
      if (!cloudinaryUrl) {
        return res.status(404).json({ error: 'No image for this property' });
      }

      cacheSet(cacheKey, cloudinaryUrl);
    }

    // ── 4. Validate URL before proxying ──────────────────────────
    if (!isAllowedUrl(cloudinaryUrl)) {
      console.error('[imageProxy] Blocked non-Cloudinary URL:', cloudinaryUrl);
      return res.status(502).json({ error: 'Invalid image source' });
    }

    // ── 5. Proxy the image ────────────────────────────────────────
    const parsed   = new URL(cloudinaryUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;

    const proxyReq = protocol.get(cloudinaryUrl, (proxyRes) => {
      // Only forward safe headers — never leak upstream server info
      const contentType   = proxyRes.headers['content-type']   || 'image/jpeg';
      const contentLength = proxyRes.headers['content-length'];

      // Block non-image responses (e.g. Cloudinary error HTML)
      if (!contentType.startsWith('image/')) {
        console.error('[imageProxy] Non-image content-type from Cloudinary:', contentType);
        return res.status(502).json({ error: 'Unexpected image response' });
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
      if (!res.headersSent) res.status(502).json({ error: 'Image fetch failed' });
    });

    // Abort upstream request if client disconnects
    res.on('close', () => proxyReq.destroy());

  } catch (err) { next(err); }
});

export default router;
