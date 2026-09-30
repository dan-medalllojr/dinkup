// Dinkup runs on Manila time. The Philippines has no daylight saving, so the
// offset is always +08:00 and a date + time from a form maps to one instant.
export const MANILA_OFFSET = '+08:00';

/** "2026-10-04" + "18:30" (Manila wall clock) → ISO string with offset. */
export function manilaToIso(date: string, time: string): string {
  return `${date}T${time}:00${MANILA_OFFSET}`;
}

/** Today's date in Manila as YYYY-MM-DD, regardless of the device's timezone. */
export function todayInManila(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
}

/** The UTC instants bounding a Manila calendar day: [start, end). */
export function manilaDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00${MANILA_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** YYYY-MM-DD for the Manila date `days` after `date`. */
export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
