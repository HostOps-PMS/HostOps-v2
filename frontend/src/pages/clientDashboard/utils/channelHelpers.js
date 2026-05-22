/**
 * Brand colors per booking channel.
 */
export const CHANNEL_COLORS = {
  Airbnb: '#ec4899',
  'Booking.com': '#3b82f6',
  VRBO: '#8b5cf6',
  Agoda: '#64748b',
  Direct: '#10b981',
  'Direct booking': '#10b981',
  Website: '#94a3b8',
  W: '#94a3b8',
  Facebook: '#1877F2',
  WhatsApp: '#25D366',
};

/**
 * CSS class names for calendar pill backgrounds per channel.
 */
export const CHANNEL_PILL_CLASS = {
  Airbnb: 'cal-pill-airbnb',
  'Booking.com': 'cal-pill-booking',
  VRBO: 'cal-pill-vrbo',
  Agoda: 'cal-pill-agoda',
  Direct: 'cal-pill-direct',
  'Direct booking': 'cal-pill-direct',
  Website: 'cal-pill-website',
  W: 'cal-pill-website',
  Facebook: 'cal-pill-booking',
  WhatsApp: 'cal-pill-direct',
};

/**
 * Returns the color for a given channel, with a fallback.
 */
export function getChannelColor(channel) {
  return CHANNEL_COLORS[channel] || '#56c299';
}

/**
 * Returns the CSS pill class for a given channel, with a fallback.
 */
export function getChannelPillClass(channel) {
  return CHANNEL_PILL_CLASS[channel] || 'cal-pill-default';
}

/**
 * Returns the first letter initial of a channel name.
 */
export function getChannelInitial(channel) {
  return (channel?.[0] || 'D').toUpperCase();
}
