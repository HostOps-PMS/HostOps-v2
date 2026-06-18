/**
 * Client-side AES-256-GCM response decryption using the WebCrypto API.
 * Mirrors the server's encryptPayload() in responseEncryption.js.
 */

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToB64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decrypts an encrypted API response envelope.
 * Expects: { e: 1, d: base64, i: base64, t: base64 }
 * Returns the original JSON-parsed object.
 */
export async function decryptApiResponse(payload, sessionKeyB64) {
  if (!payload || payload.e !== 1 || !sessionKeyB64) return payload;

  try {
    const keyBytes = b64ToBytes(sessionKeyB64);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const iv  = b64ToBytes(payload.i);
    const enc = b64ToBytes(payload.d);
    const tag = b64ToBytes(payload.t);

    const combined = new Uint8Array(enc.length + tag.length);
    combined.set(enc);
    combined.set(tag, enc.length);

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      combined,
    );

    return JSON.parse(new TextDecoder().decode(plain));
  } catch (err) {
    // OperationError is thrown when the session key is stale or mismatched.
    // Clear the bad key so the next refresh cycle can set a fresh one.
    console.warn('[decryptApiResponse] Decryption failed (stale session key?), clearing key:', err.name);
    sessionStorage.removeItem('hp_session_key');
    return payload;
  }
}

/**
 * Generates an HMAC-SHA256 signed session hint for the X-Session-Hint header.
 * Format: "<timestamp>.<nonce_b64url>.<mac_b64url>"
 */
export async function generateSessionHint(sessionKeyB64) {
  if (!sessionKeyB64) return null;

  const keyBytes = b64ToBytes(sessionKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const timestamp  = Date.now().toString();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(8));
  const nonce      = bytesToB64Url(nonceBytes);
  const message    = new TextEncoder().encode(`${timestamp}.${nonce}`);
  const macBytes   = await crypto.subtle.sign('HMAC', cryptoKey, message);

  return `${timestamp}.${nonce}.${bytesToB64Url(new Uint8Array(macBytes))}`;
}
