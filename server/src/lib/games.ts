import { gameDisplayStatus, gameEndsAt, type Game, type PlayerSummary } from '@dinkup/shared';
import type { Prisma, User } from '../generated/prisma/client.ts';
import { fromDbLevel } from './users.ts';

// Everything a game response needs, in one query.
export const gameInclude = {
  court: true,
  host: true,
  players: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
} satisfies Prisma.GameInclude;

type GameWithRelations = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

function toPlayerSummary(u: User): PlayerSummary {
  return { id: u.id, name: u.name, photoUrl: u.photoUrl, skillLevel: fromDbLevel(u.skillLevel) };
}

export function toGame(g: GameWithRelations, now = new Date()): Game {
  return {
    id: g.id,
    court: { id: g.court.id, name: g.court.name, address: g.court.address, city: g.court.city, lat: g.court.lat, lng: g.court.lng },
    host: toPlayerSummary(g.host),
    startsAt: g.startsAt.toISOString(),
    endsAt: gameEndsAt(g.startsAt, g.durationMin).toISOString(),
    durationMin: g.durationMin,
    format: g.format,
    capacity: g.capacity,
    minSkillLevel: g.minSkillLevel && fromDbLevel(g.minSkillLevel),
    status: gameDisplayStatus({ ...g, playerCount: g.players.length }, now),
    players: g.players.map((p) => ({ ...toPlayerSummary(p.user), joinedAt: p.joinedAt.toISOString() })),
    createdAt: g.createdAt.toISOString(),
  };
}

const LONGEST_GAME_MIN = 240;

/**
 * A non-cancelled game this user is playing in that overlaps [startsAt, startsAt + duration).
 * Used when hosting now, and again when joining in step 5.
 */
export async function findScheduleClash(
  tx: Prisma.TransactionClient,
  userId: string,
  startsAt: Date,
  durationMin: number,
) {
  const endsAt = gameEndsAt(startsAt, durationMin);
  // Any game that could overlap must start within this window.
  const candidates = await tx.game.findMany({
    where: {
      status: { not: 'cancelled' },
      players: { some: { userId } },
      startsAt: { gt: new Date(startsAt.getTime() - LONGEST_GAME_MIN * 60_000), lt: endsAt },
    },
    include: { court: true },
  });
  return candidates.find((g) => gameEndsAt(g.startsAt, g.durationMin) > startsAt) ?? null;
}

/**
 * Row-lock the user for the rest of the transaction. Serializes this user's
 * writes, so two quick submits can't both pass the "already booked" and
 * "too many games" checks before either one inserts.
 */
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}

/**
 * Row-lock a game for the rest of the transaction. Joins, leaves, and cancels
 * on the same game run one at a time, so two people can't take the last spot.
 *
 * Lock order is always user, then game. Every path that takes both locks
 * takes them in that order, so two transactions can't deadlock waiting on
 * each other.
 */
export async function lockGame(tx: Prisma.TransactionClient, gameId: string) {
  await tx.$queryRaw`SELECT id FROM games WHERE id = ${gameId}::uuid FOR UPDATE`;
}
