import crypto from 'crypto';

const ALG = 'aes-256-gcm';

// Primary key from env. For production, this MUST be set in .env / Render.
const rawKey = process.env.FIELD_ENCRYPTION_KEY;
if (!rawKey || rawKey.trim().length !== 64) {
  console.warn('⚠️  WARNING: FIELD_ENCRYPTION_KEY is missing or invalid (must be 64 hex chars).');
}

// Build a list of candidate keys to try when decrypting. This makes the app
// resilient when data was encrypted under a slightly different key (e.g. a
// value saved before the env key was set, which used the zero fallback).
// Encryption ALWAYS uses the primary key.
const PRIMARY_KEY = rawKey && rawKey.trim().length === 64
  ? Buffer.from(rawKey.trim(), 'hex')
  : Buffer.alloc(32);

const ZERO_KEY = Buffer.alloc(32); // legacy fallback used when no env key existed

const CANDIDATE_KEYS = [PRIMARY_KEY];
if (!PRIMARY_KEY.equals(ZERO_KEY)) CANDIDATE_KEYS.push(ZERO_KEY);

/**
 * Checks if a string appears to be correctly formatted encrypted data (iv:enc:tag).
 */
export function isEncrypted(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  // 12 bytes IV = 24 hex chars, 16 bytes Auth Tag = 32 hex chars
  return parts.length === 3 && parts[0].length === 24 && parts[2].length === 32;
}

export function encrypt(plain) {
  if (!plain) return plain;
  if (isEncrypted(plain)) return plain; // Prevent double encryption

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALG, PRIMARY_KEY, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${enc.toString('hex')}:${cipher.getAuthTag().toString('hex')}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plain;
  }
}

/**
 * Decrypts a stored value.
 *  - Plaintext (not in iv:enc:tag format) is returned unchanged.
 *  - Encrypted values are tried against each candidate key.
 *  - If every key fails, returns '' (empty) so callers can cleanly skip the
 *    value instead of passing an undecryptable ciphertext downstream. It no
 *    longer spams the logs on every failure.
 */
export function decrypt(stored) {
  if (!stored) return stored;
  if (!isEncrypted(stored)) return stored; // plain-text data — return as-is

  const [ivHex, encHex, tagHex] = stored.split(':');
  let iv, enc, tag;
  try {
    iv  = Buffer.from(ivHex, 'hex');
    enc = Buffer.from(encHex, 'hex');
    tag = Buffer.from(tagHex, 'hex');
  } catch {
    return ''; // malformed hex
  }

  for (const key of CANDIDATE_KEYS) {
    try {
      const decipher = crypto.createDecipheriv(ALG, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      // try next candidate key
    }
  }

  // Nothing worked — likely encrypted under a different secret than any we have.
  // Return empty so the caller skips it gracefully (no log spam).
  return '';
}

/**
 * Returns true if `stored` can actually be decrypted with a known key.
 * Useful for diagnostics / migrations.
 */
export function canDecrypt(stored) {
  if (!isEncrypted(stored)) return true; // plaintext is "usable" as-is
  return decrypt(stored) !== '';
}
