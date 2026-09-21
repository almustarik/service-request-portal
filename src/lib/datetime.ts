/**
 * Timestamps are stored as UTC ISO strings and always rendered in the
 * organisation's timezone. Pinning the zone keeps server-rendered output stable
 * for every user and avoids server/client hydration mismatches.
 */
const DISPLAY_TIME_ZONE = 'Asia/Dhaka';

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormat.format(date) : 'Unknown date';
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormat.format(date) : 'Unknown date';
}

const RELATIVE_UNITS: [limit: number, divisor: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60_000, 1_000, 'second'],
  [3_600_000, 60_000, 'minute'],
  [86_400_000, 3_600_000, 'hour'],
  [2_592_000_000, 86_400_000, 'day'],
];

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Falls back to an absolute date beyond a month, where "38 days ago" stops helping. */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  const date = toDate(value);
  if (!date) return 'Unknown date';

  const elapsed = now - date.getTime();
  if (Math.abs(elapsed) >= 2_592_000_000) return dateFormat.format(date);

  for (const [limit, divisor, unit] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) < limit) {
      return relativeFormat.format(-Math.round(elapsed / divisor), unit);
    }
  }
  return dateFormat.format(date);
}

/** Compact duration for report figures, e.g. "6d 4h" or "45m". */
export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds) || milliseconds < 0) return '—';

  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
