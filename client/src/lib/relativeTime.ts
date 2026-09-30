import { TIMEZONE } from '@dinkup/shared';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const older = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "just now", "5 min ago", "2 hours ago", then an absolute date after a day. */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (seconds > -45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, 'hour');
  return older.format(new Date(iso));
}
