import crypto from 'crypto';

const ALG = 'aes-256-gcm';
// Ensure the key exists, otherwise provide a fallback or throw. 
// For production, this MUST be set in .env.
const rawKey = process.env.FIELD_ENCRYPTION_KEY;
if (!rawKey || rawKey.length !== 64) {
  console.warn('⚠️  WARNING: •••••••• is missing or invalid in .env (must be 64 hex chars).');
}
const KEY = rawKey ? Buffer.from(rawKey, 'hex') : Buffer.alloc(32);

/**
 * Checks if a string appears to be correctly formatted encrypted data (iv:enc:tag).
 */
export function isEncrypted(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  // 12 bytes IV = 24 hex chars
  // 16 bytes Auth Tag = 32 hex chars
  return parts.length === 3 && parts[0].length === 24 && parts[2].length === 32;
}

export function encrypt(plain) {
  if (!plain) return plain;
  if (isEncrypted(plain)) return plain; // Prevent double encryption

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALG, KEY, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${enc.toString('hex')}:${cipher.getAuthTag().toString('hex')}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plain;
  }
}

export function decrypt(stored) {
  if (!stored) return stored;
  if (!isEncrypted(stored)) return stored; // Fallback for existing unencrypted plain-text data

  try {
    const [iv, enc, tag] = stored.split(':').map(s => Buffer.from(s, 'hex'));
    const decipher = crypto.createDecipheriv(ALG, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('Decryption failed:', err);
    // If decryption fails, safely fallback to the stored string so the app doesn't crash
    return stored;
  }
}
