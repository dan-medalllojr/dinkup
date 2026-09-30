import { Router } from 'express';
import { z } from 'zod';
import {
  createGameSchema,
  distanceKm,
  GAME_CAPACITY,
  listGamesQuerySchema,
  manilaDayRange,
  MAX_UPCOMING_HOSTED_GAMES,
  meetsMinLevel,
  SKILL_LEVELS,
  type GameListItem,
} from '@dinkup/shared';
import { prisma } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { findScheduleClash, gameInclude, lockGame, lockUser, toGame } from '../lib/games.ts';
import { HttpError } from '../lib/http-error.ts';
import { fromDbLevel, toDbLevel } from '../lib/users.ts';
import { requireAuth } from '../middleware/auth.ts';

export const gamesRouter = Router();

const MAX_GAMES_FOR_DISTANCE_SORT = 500;

const TIME_FORMAT = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

gamesRouter.post('/', requireAuth, async (req, res) => {
  const input = createGameSchema.parse(req.body);
  const hostId = req.session.userId!;
  const startsAt = new Date(input.startsAt);

  const game = await prisma.$transaction(async (tx) => {
    await lockUser(tx, hostId);

    const court = await tx.court.findUnique({ where: { id: input.courtId } });
    if (!court) throw new HttpError(404, 'Court not found');

    const upcoming = await tx.game.count({
      where: { hostId, status: 'open', startsAt: { gt: new Date() } },
    });
    if (upcoming >= MAX_UPCOMING_HOSTED_GAMES) {
      throw new HttpError(409, `You can host up to ${MAX_UPCOMING_HOSTED_GAMES} upcoming games at a time`);
    }

    const clash = await findScheduleClash(tx, hostId, startsAt, input.durationMin);
    if (clash) {
      throw new HttpError(409, `You're already playing at ${clash.court.name} then (${TIME_FORMAT.format(clash.startsAt)})`);
    }

    return tx.game.create({
      data: {
        hostId,
        courtId: court.id,
        startsAt,
        durationMin: input.durationMin,
        format: input.format,
        capacity: GAME_CAPACITY[input.format],
        minSkillLevel: input.minSkillLevel && toDbLevel(input.minSkillLevel),
        // The host is always the first player.
        players: { create: { userId: hostId } },
      },
      include: gameInclude,
    });
  });

  res.status(201).json({ game: toGame(game) });
});

// Public: guests browse games without an account. Only games that haven't
// started yet are listed, since you can't join one in progress. Full games stay
// in the list (with a "Full" badge) so the board doesn't look emptier than it is.
gamesRouter.get('/', async (req, res) => {
  const q = listGamesQuerySchema.parse(req.query);
  const now = new Date();

  const startsAt: Prisma.DateTimeFilter = { gt: now };
  if (q.date) {
    // "Today" means the Manila calendar day, not the server's or the phone's.
    const { start, end } = manilaDayRange(q.date);
    startsAt.gte = start;
    startsAt.lt = end;
  }

  const where: Prisma.GameWhereInput = { status: 'open', startsAt };
  if (q.format) where.format = q.format;
  if (q.level) {
    // Games this level can join: no minimum, or a minimum at or below it.
    const allowed = SKILL_LEVELS.slice(0, SKILL_LEVELS.indexOf(q.level) + 1).map(toDbLevel);
    where.OR = [{ minSkillLevel: null }, { minSkillLevel: { in: allowed } }];
  }

  // Distance isn't a column, so sorting by it happens here. Taking `limit` rows
  // first would give the soonest N, not the nearest N; fetch a bounded larger
  // set instead (upcoming games in Metro Cebu are well under this).
  const rows = await prisma.game.findMany({
    where,
    include: gameInclude,
    orderBy: { startsAt: 'asc' },
    take: q.near ? MAX_GAMES_FOR_DISTANCE_SORT : q.limit,
  });
  const games: GameListItem[] = rows.map((g) => ({
    ...toGame(g, now),
    distanceKm: q.near ? distanceKm(q.near, g.court) : null,
  }));
  // Nearest first when we know where the player is; soonest breaks ties.
  if (q.near) games.sort((a, b) => a.distanceKm! - b.distanceKm! || a.startsAt.localeCompare(b.startsAt));

  res.json({ games: games.slice(0, q.limit) });
});

// Games I'm hosting or playing in that haven't ended, including cancelled
// ones so players find out. Registered before /:id so "mine" isn't taken as an id.
gamesRouter.get('/mine', requireAuth, async (req, res) => {
  const now = new Date();
  const rows = await prisma.game.findMany({
    where: {
      players: { some: { userId: req.session.userId } },
      status: { in: ['open', 'cancelled'] },
      // Ends after now. Duration varies per game, so over-fetch by the longest
      // possible game and filter precisely below.
      startsAt: { gt: new Date(now.getTime() - 240 * 60_000) },
    },
    include: gameInclude,
    orderBy: { startsAt: 'asc' },
  });
  const games = rows.map((g) => toGame(g, now)).filter((g) => g.status !== 'completed');
  res.json({ games });
});

// Public so a shared game link works for guests.
gamesRouter.get('/:id', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const game = id.success ? await prisma.game.findUnique({ where: { id: id.data }, include: gameInclude }) : null;
  if (!game) throw new HttpError(404, 'Game not found');
  res.json({ game: toGame(game) });
});

gamesRouter.post('/:id/cancel', requireAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, 'Game not found');

  const game = await prisma.$transaction(async (tx) => {
    // Serialized with joins and leaves on the same game.
    await lockGame(tx, id.data);
    const existing = await tx.game.findUnique({ where: { id: id.data } });
    if (!existing) throw new HttpError(404, 'Game not found');
    if (existing.hostId !== req.session.userId) throw new HttpError(403, 'Only the host can cancel this game');
    if (existing.status !== 'open') throw new HttpError(409, 'This game is already cancelled');
    if (existing.startsAt <= new Date()) throw new HttpError(409, "This game has already started, so it can't be cancelled");

    return tx.game.update({ where: { id: existing.id }, data: { status: 'cancelled' }, include: gameInclude });
  });

  res.json({ game: toGame(game) });
});

gamesRouter.post('/:id/join', requireAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, 'Game not found');
  const userId = req.session.userId!;

  const game = await prisma.$transaction(async (tx) => {
    // User first, then game (see lockGame). The user lock stops one person
    // joining two overlapping games at once; the game lock stops two people
    // taking the last spot at once.
    await lockUser(tx, userId);
    await lockGame(tx, id.data);

    const existing = await tx.game.findUnique({ where: { id: id.data }, include: { players: true } });
    if (!existing) throw new HttpError(404, 'Game not found');
    if (existing.status === 'cancelled') throw new HttpError(409, 'This game was cancelled');
    if (existing.startsAt <= new Date()) throw new HttpError(409, 'This game has already started');
    if (existing.players.some((p) => p.userId === userId)) throw new HttpError(409, "You're already in this game");
    if (existing.players.length >= existing.capacity) throw new HttpError(409, 'This game is full');

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const min = existing.minSkillLevel && fromDbLevel(existing.minSkillLevel);
    if (!meetsMinLevel(fromDbLevel(user.skillLevel), min)) {
      throw new HttpError(403, `This game is for ${min}+ players, and you're ${fromDbLevel(user.skillLevel)}`);
    }

    const clash = await findScheduleClash(tx, userId, existing.startsAt, existing.durationMin);
    if (clash) {
      throw new HttpError(409, `You're already playing at ${clash.court.name} then (${TIME_FORMAT.format(clash.startsAt)})`);
    }

    await tx.gamePlayer.create({ data: { gameId: existing.id, userId } });
    return tx.game.findUniqueOrThrow({ where: { id: existing.id }, include: gameInclude });
  });

  res.json({ game: toGame(game) });
});

gamesRouter.post('/:id/leave', requireAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, 'Game not found');
  const userId = req.session.userId!;

  const game = await prisma.$transaction(async (tx) => {
    await lockGame(tx, id.data);
    const existing = await tx.game.findUnique({ where: { id: id.data }, include: { players: true } });
    if (!existing) throw new HttpError(404, 'Game not found');
    if (!existing.players.some((p) => p.userId === userId)) throw new HttpError(409, "You're not in this game");
    // A game without its host would be orphaned; hosts cancel instead.
    if (existing.hostId === userId) throw new HttpError(409, "Hosts can't leave their own game. Cancel it instead.");
    if (existing.startsAt <= new Date()) throw new HttpError(409, 'This game has already started');

    await tx.gamePlayer.delete({ where: { gameId_userId: { gameId: existing.id, userId } } });
    return tx.game.findUniqueOrThrow({ where: { id: existing.id }, include: gameInclude });
  });

  res.json({ game: toGame(game) });
});
