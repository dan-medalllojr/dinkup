import { z } from 'zod';
import { inCebu } from './geo';

const coords = {
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

const courtFields = z.object({
  name: z.string().trim().min(3, 'Give the court a name (at least 3 characters)').max(100),
  address: z.string().trim().max(200).default(''),
  city: z.string().trim().max(60).default(''),
  ...coords,
});

export const createCourtSchema = courtFields.refine(inCebu, {
  path: ['lat'],
  message: 'Courts must be in Cebu',
});
export type CreateCourtInput = z.input<typeof createCourtSchema>;

// The player who added a court can fix its details or move the pin.
export const updateCourtSchema = courtFields
  .partial()
  .strict()
  .refine((c) => (c.lat === undefined) === (c.lng === undefined), { path: ['lat'], message: 'Send lat and lng together' })
  .refine((c) => c.lat === undefined || inCebu({ lat: c.lat, lng: c.lng! }), { path: ['lat'], message: 'Courts must be in Cebu' });
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>;

// --- Searching our own courts --------------------------------------------------

type Searchable = { name: string; address: string; city: string };

const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Courts matching what the player typed, best first. Every typed word must
 * start a word in the name, address, or city ("dula", "pickle mandaue"), or
 * start a run of name words typed without spaces or punctuation ("sideout").
 * Name matches rank above address/city matches.
 */
export function matchCourts<T extends Searchable>(courts: T[], query: string, limit = 5): T[] {
  const q = words(query);
  if (q.length === 0) return [];
  const qCompact = q.join('');

  const scored: { court: T; rank: number }[] = [];
  for (const court of courts) {
    const name = words(court.name);
    // "side-out pickleball" → ["sideoutpickleball", "outpickleball", "pickleball"]
    const runs = name.map((_, i) => name.slice(i).join(''));
    const all = [...name, ...words(court.address), ...words(court.city)];
    const inName = (t: string) => runs.some((r) => r.startsWith(t));
    if (!q.every((t) => inName(t) || all.some((w) => w.startsWith(t)))) continue;
    const rank = name.join('').startsWith(qCompact) ? 0 : q.every(inName) ? 1 : 2;
    scored.push({ court, rank });
  }
  // Stable sort keeps the caller's order (alphabetical from the API) within a rank.
  return scored
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.court);
}
