/**
 * safeStorage.js
 *
 * A localStorage wrapper with a silent in-memory fallback.
 *
 * Why this exists:
 *   In some browser/iframe contexts (e.g. third-party cookie restrictions,
 *   Safari ITP, or certain iframe sandbox policies), accessing localStorage
 *   throws a SecurityError BEFORE you can even read it. A simple try/catch
 *   around individual getItem/setItem calls is not enough — the property
 *   access itself throws.
 *
 *   This module detects the failure once at module load time and switches
 *   transparently to an in-memory Map for the rest of the session.
 *   The API is identical to localStorage so call-sites need zero changes.
 *
 * Usage:
 *   import safeStorage from './safeStorage';
 *   safeStorage.setItem('hp_access_token', token);
 *   safeStorage.getItem('hp_access_token');
 *   safeStorage.removeItem('hp_access_token');
 */

const memoryStore = new Map();

/** Returns true if localStorage is accessible in this browser context. */
function localStorageAvailable() {
  try {
    const probe = '__hp_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const USE_LOCAL_STORAGE = localStorageAvailable();

if (!USE_LOCAL_STORAGE) {
  console.warn(
    '[safeStorage] localStorage is not available in this context ' +
    '(SecurityError or quota exceeded). Falling back to in-memory storage. ' +
    'Auth state will not survive a page reload.'
  );
}

const safeStorage = {
  /**
   * Returns true when the real localStorage is being used,
   * false when running on the in-memory fallback.
   * Useful for showing a "session won't persist" warning in the UI.
   */
  isPersistent: USE_LOCAL_STORAGE,

  getItem(key) {
    if (USE_LOCAL_STORAGE) {
      try { return localStorage.getItem(key); }
      catch { return memoryStore.get(key) ?? null; }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key, value) {
    if (USE_LOCAL_STORAGE) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch { /* fall through to memory */ }
    }
    memoryStore.set(key, String(value));
  },

  removeItem(key) {
    if (USE_LOCAL_STORAGE) {
      try {
        localStorage.removeItem(key);
        return;
      } catch { /* fall through to memory */ }
    }
    memoryStore.delete(key);
  },
};

export default safeStorage;
