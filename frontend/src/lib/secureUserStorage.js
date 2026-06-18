/**
 * secureUserStorage.js
 * 
 * Provides AES encryption for the `hp_user` object in storage using crypto-js.
 * This prevents sensitive user profile data from being stored in plain JSON.
 * It uses `safeStorage` underneath.
 */
import CryptoJS from 'crypto-js';
import safeStorage from '../pages/safeStorage';

const STORAGE_KEY = 'hp_user';

// Derived from VITE_API_KEY if available, else a fallback
const APP_SECRET = import.meta.env.VITE_API_KEY || 'hostops-v2-fallback-secret';

/**
 * Returns the parsed user object from storage.
 * If the data is encrypted, decrypts it.
 * If the data is plain JSON (legacy), it reads it, re-encrypts it, and returns it.
 */
export function getSecureUser() {
  const raw = safeStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  // Check if it's our encrypted payload (base64 from crypto-js starts with U2FsdGVkX1)
  if (raw.startsWith('U2FsdGVkX1')) {
    try {
      const bytes = CryptoJS.AES.decrypt(raw, APP_SECRET);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) throw new Error('Malformed UTF-8 data');
      
      return JSON.parse(decryptedString);
    } catch (e) {
      console.error('[secureUserStorage] Decryption failed, clearing session:', e);
      safeStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  // Fallback: It might be legacy plain JSON.
  try {
    const parsed = JSON.parse(raw);
    // Opportunistically re-encrypt so it's secure on next load
    setSecureUser(parsed);
    return parsed;
  } catch (e) {
    // If it's not JSON either, just clear it
    safeStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Encrypts the user object and stores it.
 */
export function setSecureUser(userObj) {
  if (!userObj) {
    safeStorage.removeItem(STORAGE_KEY);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return;
  }

  try {
    const jsonString = JSON.stringify(userObj);
    const ciphertext = CryptoJS.AES.encrypt(jsonString, APP_SECRET).toString();
    safeStorage.setItem(STORAGE_KEY, ciphertext);
  } catch (e) {
    console.error('[secureUserStorage] Encryption failed, falling back to plain storage:', e);
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
  }
}

/**
 * Removes the user from storage.
 */
export function removeSecureUser() {
  safeStorage.removeItem(STORAGE_KEY);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
