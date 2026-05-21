/**
 * Storage helpers to safely interact with localStorage and sessionStorage.
 */

export const getStorageItem = (key, useLocal = false) => {
  try {
    const storage = useLocal ? localStorage : sessionStorage;
    const value = storage.getItem(key);
    if (!value) return null;
    
    // Attempt parsing in case it's stringified JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`Error reading key "${key}" from storage:`, error);
    return null;
  }
};

export const setStorageItem = (key, value, useLocal = false) => {
  try {
    const storage = useLocal ? localStorage : sessionStorage;
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    storage.setItem(key, valueToStore);
  } catch (error) {
    console.error(`Error setting key "${key}" to storage:`, error);
  }
};

export const removeStorageItem = (key, useLocal = false) => {
  try {
    const storage = useLocal ? localStorage : sessionStorage;
    storage.removeItem(key);
  } catch (error) {
    console.error(`Error removing key "${key}" from storage:`, error);
  }
};

export const clearStorage = (useLocal = false) => {
  try {
    const storage = useLocal ? localStorage : sessionStorage;
    storage.clear();
  } catch (error) {
    console.error(`Error clearing storage:`, error);
  }
};
