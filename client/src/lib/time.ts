import { TIMEZONE } from '@dinkup/shared';

const dayFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit' });

/** "Sat, Oct 4 · 6:00 – 7:30 PM", always in Manila time. */
export function formatGameWhen(startsAt: string, endsAt: string): string {
  const start = timeFmt.format(new Date(startsAt));
  const end = timeFmt.format(new Date(endsAt));
  // Drop the first AM/PM when both times share it: "6:00 – 7:30 PM".
  const [startTime, startPeriod] = start.split(' ');
  const [, endPeriod] = end.split(' ');
  const startLabel = startPeriod === endPeriod ? startTime : start;
  return `${dayFmt.format(new Date(startsAt))} · ${startLabel} – ${end}`;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}
