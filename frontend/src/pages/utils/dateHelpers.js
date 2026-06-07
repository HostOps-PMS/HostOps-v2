/**
 * Converts a Date object to "YYYY-MM-DD" using local timezone.
 */
export function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely extracts "YYYY-MM-DD" from a string or Date, ignoring timezones.
 */
export function toYMD(input) {
  if (!input) return '';
  if (typeof input === 'string') return input.slice(0, 10);
  if (input instanceof Date) {
    return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, '0')}-${String(input.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Returns the number of days between two "YYYY-MM-DD" strings.
 * Uses noon to avoid DST edge cases.
 */
export function dayDiff(ymd1, ymd2) {
  const d1 = new Date(`${ymd1}T12:00:00`);
  const d2 = new Date(`${ymd2}T12:00:00`);
  return Math.round((d2 - d1) / 86_400_000);
}

/**
 * Formats an ISO date string as "Mon 01.05.2025".
 */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Formats an ISO date as "Jan 1, 2025".
 */
export function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Returns a "2m ago" style string from an ISO timestamp.
 */
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Formats a number as Philippine Peso currency.
 */
export function fmtMoney(n) {
  return '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Returns { from, to } ISO strings for common preset ranges.
 */
export function getPresetRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from;
  let to = new Date(today);

  switch (preset) {
    case 'daily':
      from = new Date(today);
      break;
    case 'weekly': {
      const day = today.getDay();
      from = new Date(today);
      from.setDate(today.getDate() - ((day + 6) % 7));
      to = new Date(from);
      to.setDate(from.getDate() + 6);
      break;
    }
    case 'monthly':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'yearly':
      from = new Date(today.getFullYear(), 0, 1);
      to = new Date(today.getFullYear(), 11, 31);
      break;
    case 'ytd':
      from = new Date(today.getFullYear(), 0, 1);
      break;
    case 'mtd':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'last30':
      from = new Date(today);
      from.setDate(from.getDate() - 30);
      break;
    case 'last7':
      from = new Date(today);
      from.setDate(from.getDate() - 7);
      break;
    case 'thismonth':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'lastmonth':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  return { from: toISODate(from), to: toISODate(to) };
}

/**
 * Preset labels map.
 */
export const PRESET_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  ytd: 'Year to date',
  mtd: 'Month to date',
  last30: 'Last 30 days',
  last7: 'Last 7 days',
  thismonth: 'This month',
  lastmonth: 'Last month',
};

export const ALL_PRESETS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];
