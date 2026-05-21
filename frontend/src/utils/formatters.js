/**
 * Value formatting utilities.
 */

export const formatEmail = (email) => {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

export const formatName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};
