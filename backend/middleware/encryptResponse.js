import { getSessionKey, encryptPayload, verifySessionHint } from '../utils/responseEncryption.js';

/**
 * Patches res.json so that authenticated /api/* responses are AES-256-GCM
 * encrypted when a session key exists for the request's JWT JTI.
 *
 * Apply globally (before routes). req._jti is read at res.json() call-time
 * (after requireAuth sets it), not at middleware-registration time.
 */
export function encryptApiResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    const jti = req._jti;
    if (!jti) return originalJson(data);

    const sessionKey = getSessionKey(jti);
    if (!sessionKey) return originalJson(data);

    const hint = req.headers['x-session-hint'];
    if (hint && !verifySessionHint(hint, sessionKey)) {
      console.warn(`[encryptResponse] Bad session hint — path=${req.path} jti=${jti}`);
    }

    try {
      const encrypted = encryptPayload(data, sessionKey);
      res.setHeader('X-Enc', '1');
      return originalJson(encrypted);
    } catch (err) {
      console.error('[encryptResponse] Encryption failed:', err.message);
      return originalJson(data);
    }
  };

  next();
}
