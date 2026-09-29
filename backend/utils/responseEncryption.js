import crypto from 'crypto';

const ALG = 'aes-256-gcm';

function getMasterKey() {
  const k = process.env.RESPONSE_MASTER_KEY;
  if (!k || k.length !== 64) return null;
  return Buffer.from(k, 'hex');
}

function getHmacKey() {
  const k = process.env.RESPONSE_HMAC_KEY;
  if (!k || k.length !== 64) return null;
  return Buffer.from(k, 'hex');
}

// In-memory session key store: jti → { key: Buffer, expiresAt: number }
const _store = new Map();
let _lastPrune = 0;

function prune() {
  const now = Date.now();
  if (now - _lastPrune < 60_000) return;
  _lastPrune = now;
  for (const [jti, entry] of _store) {
    if (entry.expiresAt < now) _store.delete(jti);
  }
}

/**
 * Derives and stores a per-session AES key with HKDF-SHA256 (master key +
 * random salt + jti). Called once per login/refresh for each new access token JTI.
 * HKDF, not PBKDF2: the master key is already random, so key stretching adds
 * nothing — and pbkdf2Sync blocked the whole event loop on every login.
 * Returns the base64-encoded session key to send to the client, or null if
 * RESPONSE_MASTER_KEY is not configured.
 */
export function createSessionKey(jti, ttlMs = 8 * 3600_000) {
  const masterKey = getMasterKey();
  if (!masterKey || !jti) return null;

  prune();

  const salt = crypto.randomBytes(16);
  const key = Buffer.from(crypto.hkdfSync('sha256', masterKey, salt, String(jti), 32));

  _store.set(jti, { key, expiresAt: Date.now() + ttlMs });

  return key.toString('base64');
}

/**
 * Retrieves the session key Buffer for the given JTI.
 * Returns null if not found or expired.
 */
export function getSessionKey(jti) {
  if (!jti) return null;
  const entry = _store.get(jti);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    _store.delete(jti);
    return null;
  }
  return entry.key;
}

/**
 * Removes the session key for the given JTI (call on logout).
 */
export function deleteSessionKey(jti) {
  if (jti) _store.delete(jti);
}

/**
 * AES-256-GCM encrypts a JSON-serializable payload.
 * Includes an HMAC-SHA256 over (iv‖enc‖tag) using RESPONSE_HMAC_KEY.
 */
export function encryptPayload(data, sessionKeyBuf) {
  const plain = JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, sessionKeyBuf, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const result = {
    e: 1,
    d: enc.toString('base64'),
    i: iv.toString('base64'),
    t: tag.toString('base64'),
  };

  const hmacKey = getHmacKey();
  if (hmacKey) {
    result.h = crypto
      .createHmac('sha256', hmacKey)
      .update(Buffer.concat([iv, enc, tag]))
      .digest('base64');
  }

  return result;
}

/**
 * Verifies an HMAC-SHA256 signed session hint from the client.
 * Hint format: "<timestamp>.<nonce_b64url>.<mac_b64url>"
 * MAC = HMAC-SHA256(sessionKey, "<timestamp>.<nonce>")
 * Timestamp must be within ±5 minutes of server time.
 */
export function verifySessionHint(hint, sessionKeyBuf) {
  if (!hint || !sessionKeyBuf) return false;
  const parts = hint.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, mac] = parts;

  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) return false;

  const expected = crypto
    .createHmac('sha256', sessionKeyBuf)
    .update(`${ts}.${nonce}`)
    .digest('base64url');

  try {
    const macBuf = Buffer.from(mac, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (macBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(macBuf, expBuf);
  } catch {
    return false;
  }
}
