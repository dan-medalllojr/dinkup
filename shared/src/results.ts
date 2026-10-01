import { z } from 'zod';
import type { SkillLevel } from './constants';
import type { PlayerSummary } from './games';

// --- Leveling and anti-boosting rules (see docs/PLAN.md) -----------------------
export const POINTS_TO_LEVEL_UP = 5;
export const REPORT_WINDOW_HOURS = 24; // after the game ends
export const CONFIRM_WINDOW_HOURS = 48; // after the report
export const SAME_OPPONENT_CAP = 2; // wins vs one opponent that can earn points…
export const SAME_OPPONENT_WINDOW_DAYS = 30; // …in this many days
export const MIN_OPPONENT_ACCOUNT_DAYS = 7;
export const MIN_OPPONENT_CONFIRMED_RESULTS = 3;

/** Why a winner got (or didn't get) a point, shown next to the result. */
export const POINTS_NOTES = {
  awarded: '+1 point',
  lower_level: 'No point: opponents are a lower level',
  opponent_cap: `No point: already beat this opponent ${SAME_OPPONENT_CAP} times in ${SAME_OPPONENT_WINDOW_DAYS} days`,
  new_opponent: `No point: opponent account is newer than ${MIN_OPPONENT_ACCOUNT_DAYS} days or has fewer than ${MIN_OPPONENT_CONFIRMED_RESULTS} confirmed results`,
} as const;
export type PointsNote = keyof typeof POINTS_NOTES;

// --- Score: one [winners, losers] pair per game -------------------------------
const gameScore = z
  .tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)])
  .refine(([a, b]) => Math.max(a, b) >= 11 && Math.abs(a - b) >= 2, {
    message: 'Each game goes to at least 11 and is won by 2',
  });

export const scoreSchema = z
  .array(gameScore)
  .min(1, 'Add at least one game')
  .max(5)
  .refine((games) => games.filter(([w, l]) => w > l).length > games.filter(([w, l]) => l > w).length, {
    message: 'The winners have to win more games than they lose',
  });

export function formatScore(games: [number, number][]): string {
  return games.map(([w, l]) => `${w}-${l}`).join(', ');
}

export const reportResultSchema = z
  .object({
    winnerIds: z.array(z.uuid()).min(1).max(2),
    loserIds: z.array(z.uuid()).min(1).max(2),
    score: scoreSchema,
  })
  .refine((r) => r.winnerIds.length === r.loserIds.length, { path: ['loserIds'], message: 'Both sides need the same number of players' })
  .refine((r) => new Set([...r.winnerIds, ...r.loserIds]).size === r.winnerIds.length + r.loserIds.length, {
    path: ['loserIds'],
    message: 'A player can only be on one side',
  });
export type ReportResultInput = z.infer<typeof reportResultSchema>;

export type ResultStatus = 'pending' | 'confirmed' | 'disputed' | 'expired';

export type ResultWinner = PlayerSummary & { points: number; pointsNote: PointsNote | null; leveledUpTo: SkillLevel | null };

export type MatchResult = {
  id: string;
  gameId: string;
  status: ResultStatus;
  score: string;
  reportedBy: PlayerSummary;
  winners: ResultWinner[];
  losers: PlayerSummary[];
  createdAt: string;
  /** Pending results expire after this. */
  confirmBy: string;
  resolvedAt: string | null;
  game: { id: string; startsAt: string; courtName: string; format: 'singles' | 'doubles' };
};
