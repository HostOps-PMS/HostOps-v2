import { classify } from '../decoy/classify.js';
import * as blocklistCache from '../utils/blocklistCache.js';
import { logEvent, logBlock } from '../utils/csvLogger.js';
import { sensor } from '../decoy/sensor.js';

export default async function honeypotGateway(req, res, next) {
  const ENABLED     = process.env.HONEYPOT_ENABLED     === 'true';
  const SHADOW_MODE = process.env.HONEYPOT_SHADOW_MODE !== 'false';

  if (!ENABLED) return next();

  try {
    const fingerprint = req.headers['x-device-fp'] || '';
    const identifier  = fingerprint || req.ip;
    const score       = classify(req);
    const { password: _, ...safeBody } = req.body || {};

    const alreadyBanned  = blocklistCache.has(identifier);
    const shouldIntercept = alreadyBanned || score.confidence >= 0.8;

    // Shadow mode: log what would have happened, then pass through
    if (SHADOW_MODE) {
      if (shouldIntercept) {
        logEvent({
          ...score,
          sessionId: req.headers['x-session-id'] || '',
          ipAddress: req.ip,
          deviceFingerprint: fingerprint,
          userAgent: req.headers['user-agent'],
          decoyResponse: 'shadow',
          payload: safeBody,
        });
        // Removed blocklist auto-ban in shadow mode
      }
      return next();
    }

    // Live mode: intercept high-confidence hits
    if (shouldIntercept) {
      logEvent({
        ...score,
        sessionId: req.headers['x-session-id'] || '',
        ipAddress: req.ip,
        deviceFingerprint: fingerprint,
        userAgent: req.headers['user-agent'],
        decoyResponse: alreadyBanned ? 'silent-drop' : 'fake-fail',
        payload: safeBody,
      });

      if (!alreadyBanned && identifier) {
        blocklistCache.add(identifier);
        logBlock({
          deviceFingerprint: identifier,
          ipAddresses: [req.ip],
          reason: 'Auto-banned due to high confidence score',
          confidenceScore: score.confidence,
          classification: score.classification,
        });
      }

      return await sensor.respond(req, res, score, { alreadyBanned });
    }

    next();
  } catch (err) {
    process.stderr.write(`[honeypotGateway] error: ${err.message}\n`);
    next();
  }
}
