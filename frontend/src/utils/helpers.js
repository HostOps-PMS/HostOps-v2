/**
 * Utility helper functions.
 */

/**
 * Join CSS class names cleanly.
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Simple delay helper.
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely parse JSON.
 */
export const safeParseJSON = (jsonString, fallback = null) => {
  try {
    return jsonString ? JSON.parse(jsonString) : fallback;
  } catch {
    return fallback;
  }
};
