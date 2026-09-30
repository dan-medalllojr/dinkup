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
