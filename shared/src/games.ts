import { z } from 'zod';
import { SKILL_LEVELS, type SkillLevel } from './constants';
import type { Court } from './schemas';

export const GAME_FORMATS = ['singles', 'doubles'] as const;
export type GameFormat = (typeof GAME_FORMATS)[number];

// Total players including the host.
export const GAME_CAPACITY: Record<GameFormat, number> = { singles: 2, doubles: 4 };

export const DURATION_OPTIONS = [60, 90, 120, 150, 180] as const;
export const DEFAULT_DURATION_MIN = 90;
export const MAX_DAYS_AHEAD = 60;
// Anti-spam: one person can't flood the board with placeholder games.
export const MAX_UPCOMING_HOSTED_GAMES = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export const createGameSchema = z
  .object({
    courtId: z.uuid('Pick a court'),
    startsAt: z.iso.datetime({ offset: true, message: 'Pick a date and time' }),
    durationMin: z.number().int().min(30).max(240).multipleOf(15),
    format: z.enum(GAME_FORMATS),
    minSkillLevel: z.enum(SKILL_LEVELS).nullable().default(null),
  })
  .refine((g) => new Date(g.startsAt).getTime() > Date.now(), {
    path: ['startsAt'],
    message: 'Start time must be in the future',
  })
  .refine((g) => new Date(g.startsAt).getTime() < Date.now() + MAX_DAYS_AHEAD * DAY_MS, {
    path: ['startsAt'],
    message: `Games can be posted up to ${MAX_DAYS_AHEAD} days ahead`,
  });
export type CreateGameInput = z.input<typeof createGameSchema>;

export function gameEndsAt(startsAt: Date | string, durationMin: number): Date {
  return new Date(new Date(startsAt).getTime() + durationMin * 60_000);
}

// What players see. "full" and "completed" are derived at read time.
export type GameDisplayStatus = 'open' | 'full' | 'cancelled' | 'completed';

export function gameDisplayStatus(
  g: { status: 'open' | 'cancelled' | 'completed'; startsAt: Date | string; durationMin: number; playerCount: number; capacity: number },
  now: Date = new Date(),
): GameDisplayStatus {
  if (g.status === 'cancelled') return 'cancelled';
  if (g.status === 'completed' || gameEndsAt(g.startsAt, g.durationMin) <= now) return 'completed';
  return g.playerCount >= g.capacity ? 'full' : 'open';
}

export type PlayerSummary = {
  id: string;
  name: string;
  photoUrl: string | null;
  skillLevel: SkillLevel;
};

export type Game = {
  id: string;
  court: Pick<Court, 'id' | 'name' | 'address' | 'city' | 'lat' | 'lng'>;
  host: PlayerSummary;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  format: GameFormat;
  capacity: number;
  minSkillLevel: SkillLevel | null;
  status: GameDisplayStatus;
  players: (PlayerSummary & { joinedAt: string })[];
  createdAt: string;
};

/** Can a player of `level` join a game with this minimum? No minimum means anyone. */
export function meetsMinLevel(level: SkillLevel, min: SkillLevel | null): boolean {
  return min === null || SKILL_LEVELS.indexOf(level) >= SKILL_LEVELS.indexOf(min);
}

export type GameListItem = Game & { distanceKm: number | null };

// Query-string filters for GET /api/games. Everything arrives as a string.
export const listGamesQuerySchema = z.object({
  date: z.iso.date().optional(),
  level: z.enum(SKILL_LEVELS).optional(),
  format: z.enum(GAME_FORMATS).optional(),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'near must be "lat,lng"')
    .transform((s) => {
      const [lat, lng] = s.split(',').map(Number) as [number, number];
      return { lat, lng };
    })
    .refine((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180, 'near is out of range')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListGamesQuery = z.input<typeof listGamesQuerySchema>;

export const COMMENT_MAX_LENGTH = 500;

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(COMMENT_MAX_LENGTH, `Keep it under ${COMMENT_MAX_LENGTH} characters`),
});

export type GameComment = {
  id: string;
  body: string;
  createdAt: string;
  author: PlayerSummary;
};
