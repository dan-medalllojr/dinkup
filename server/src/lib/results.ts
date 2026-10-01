import {
  CONFIRM_WINDOW_HOURS,
  formatScore,
  MIN_OPPONENT_ACCOUNT_DAYS,
  MIN_OPPONENT_CONFIRMED_RESULTS,
  POINTS_TO_LEVEL_UP,
  SAME_OPPONENT_CAP,
  SAME_OPPONENT_WINDOW_DAYS,
  SKILL_LEVELS,
  type MatchResult,
  type PlayerSummary,
  type PointsNote,
} from '@dinkup/shared';
import { prisma } from '../db.ts';
import type { Prisma, User } from '../generated/prisma/client.ts';
import { fromDbLevel, toDbLevel } from './users.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
type Db = Prisma.TransactionClient | typeof prisma;

export const resultInclude = {
  reportedBy: true,
  players: { include: { user: true } },
  game: { include: { court: { select: { name: true } } } },
} satisfies Prisma.MatchResultInclude;
type ResultRow = Prisma.MatchResultGetPayload<{ include: typeof resultInclude }>;

const summary = (u: User): PlayerSummary => ({ id: u.id, name: u.name, photoUrl: u.photoUrl, skillLevel: fromDbLevel(u.skillLevel), isDemo: u.isDemo });

export function toResult(r: ResultRow): MatchResult {
  return {
    id: r.id,
    gameId: r.gameId,
    status: r.status,
    score: r.score,
    reportedBy: summary(r.reportedBy),
    winners: r.players
      .filter((p) => p.side === 'winner')
      .map((p) => ({
        ...summary(p.user),
        points: p.points,
        pointsNote: p.pointsNote as PointsNote | null,
        leveledUpTo: p.leveledUpTo && fromDbLevel(p.leveledUpTo),
      })),
    losers: r.players.filter((p) => p.side === 'loser').map((p) => summary(p.user)),
    createdAt: r.createdAt.toISOString(),
    confirmBy: new Date(r.createdAt.getTime() + CONFIRM_WINDOW_HOURS * HOUR).toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    game: { id: r.game.id, startsAt: r.game.startsAt.toISOString(), courtName: r.game.court.name, format: r.game.format },
  };
}

/**
 * Lazy expiry: unanswered results lapse 48 h after being reported. Run before
 * any read or write of results, so there's no cron job to forget about.
 */
export async function expireStaleResults(db: Db = prisma, now = new Date()) {
  await db.matchResult.updateMany({
    where: { status: 'pending', createdAt: { lt: new Date(now.getTime() - CONFIRM_WINDOW_HOURS * HOUR) } },
    data: { status: 'expired', resolvedAt: now },
  });
}

export { formatScore };

const levelIndex = (level: User['skillLevel']) => SKILL_LEVELS.indexOf(fromDbLevel(level));

/**
 * Points for each winner of a result that is being confirmed. Every guard is
 * checked here, inside the confirming transaction, after the winners' rows
 * are locked (so concurrent confirmations can't both slip under the cap).
 */
export async function pointsFor(
  tx: Prisma.TransactionClient,
  winners: User[],
  losers: User[],
  now: Date,
): Promise<Map<string, { points: 0 | 1; note: PointsNote }>> {
  const out = new Map<string, { points: 0 | 1; note: PointsNote }>();

  // Guard 4: no throwaway accounts. Every opponent must be established.
  const accountsOk = await Promise.all(
    losers.map(async (l) => {
      if (now.getTime() - l.createdAt.getTime() < MIN_OPPONENT_ACCOUNT_DAYS * DAY) return false;
      const confirmed = await tx.matchResultPlayer.count({ where: { userId: l.id, result: { status: 'confirmed' } } });
      return confirmed >= MIN_OPPONENT_CONFIRMED_RESULTS;
    }),
  );
  const opponentsEstablished = accountsOk.every(Boolean);

  // Doubles: the losing side's level is the average of the two losers'.
  const losingLevel = losers.reduce((sum, l) => sum + levelIndex(l.skillLevel), 0) / losers.length;
  const since = new Date(now.getTime() - SAME_OPPONENT_WINDOW_DAYS * DAY);

  for (const w of winners) {
    if (losingLevel < levelIndex(w.skillLevel)) {
      out.set(w.id, { points: 0, note: 'lower_level' });
      continue;
    }
    // Guard 2: same-opponent cap. Beating *any* of the losers too often blocks
    // the point, so a fixed partner can't be used to farm a third player.
    let capped = false;
    for (const l of losers) {
      const priorWins = await tx.matchResult.count({
        where: {
          status: 'confirmed',
          resolvedAt: { gte: since },
          AND: [{ players: { some: { userId: w.id, side: 'winner' } } }, { players: { some: { userId: l.id, side: 'loser' } } }],
        },
      });
      if (priorWins >= SAME_OPPONENT_CAP) capped = true;
    }
    if (capped) out.set(w.id, { points: 0, note: 'opponent_cap' });
    else if (!opponentsEstablished) out.set(w.id, { points: 0, note: 'new_opponent' });
    else out.set(w.id, { points: 1, note: 'awarded' });
  }
  return out;
}

/** Add a point and level up at the threshold. Caller holds the user's row lock. */
export async function addPoint(tx: Prisma.TransactionClient, user: User) {
  const idx = levelIndex(user.skillLevel);
  const atTop = idx === SKILL_LEVELS.length - 1;
  const next = user.skillPoints + 1;
  if (next >= POINTS_TO_LEVEL_UP && !atTop) {
    const newLevel = SKILL_LEVELS[idx + 1]!;
    await tx.user.update({ where: { id: user.id }, data: { skillLevel: toDbLevel(newLevel), skillPoints: 0 } });
    return newLevel;
  }
  // Top level: the bar just stays full.
  await tx.user.update({ where: { id: user.id }, data: { skillPoints: Math.min(next, POINTS_TO_LEVEL_UP) } });
  return null;
}

export async function hasConfirmedResult(userId: string) {
  return (await prisma.matchResultPlayer.count({ where: { userId, result: { status: 'confirmed' } } })) > 0;
}
