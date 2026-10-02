import { Router } from 'express';
import { z } from 'zod';
import {
  CONFIRM_WINDOW_HOURS,
  CORRECTION_WINDOW_HOURS,
  formatScore,
  gameEndsAt,
  REPORT_WINDOW_HOURS,
  reportResultSchema,
  type ReportResultInput,
} from '@dinkup/shared';
import { prisma } from '../db.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { HttpError } from '../lib/http-error.ts';
import { addPoint, expireStaleResults, pointsFor, resultInclude, toResult } from '../lib/results.ts';
import { toDbLevel } from '../lib/users.ts';
import { requireAuth } from '../middleware/auth.ts';

export const resultsRouter = Router();
const HOUR = 60 * 60 * 1000;

const uuidParam = (value: unknown, what: string) => {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new HttpError(404, `${what} not found`);
  return id.data;
};

type GameWithPlayers = Prisma.GameGetPayload<{ include: { players: true } }>;

// The sides must be exactly the game's players, the right number per side,
// and the reporter must be on the winning side. Used by reports and corrections.
function checkSides(game: GameWithPlayers, input: ReportResultInput, reporterId: string) {
  const perSide = game.format === 'singles' ? 1 : 2;
  if (input.winnerIds.length !== perSide) throw new HttpError(400, `A ${game.format} result needs ${perSide} player${perSide > 1 ? 's' : ''} per side`);
  const named = new Set([...input.winnerIds, ...input.loserIds]);
  const joined = new Map(game.players.map((p) => [p.userId, p.joinedAt]));
  if (named.size !== joined.size || [...named].some((id) => !joined.has(id))) {
    throw new HttpError(400, 'The result has to include exactly the players in this game');
  }
  if ([...joined.values()].some((at) => at >= game.startsAt)) {
    throw new HttpError(409, 'Only games where everyone joined before the start can be reported');
  }
  if (!input.winnerIds.includes(reporterId)) throw new HttpError(403, 'Only a player on the winning side can report the result');
}

const sideRows = (input: ReportResultInput) => [
  ...input.winnerIds.map((id) => ({ userId: id, side: 'winner' as const })),
  ...input.loserIds.map((id) => ({ userId: id, side: 'loser' as const })),
];

// A winner reports the result. Guard 1 lives here: only real, scheduled games
// that have ended, with exactly the players who joined before it started.
resultsRouter.post('/games/:id/result', requireAuth, async (req, res) => {
  const gameId = uuidParam(req.params.id, 'Game');
  const input = reportResultSchema.parse(req.body);
  const userId = req.session.userId!;
  const now = new Date();

  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
  if (!game) throw new HttpError(404, 'Game not found');
  if (game.status === 'cancelled') throw new HttpError(409, 'This game was cancelled');
  const endsAt = gameEndsAt(game.startsAt, game.durationMin);
  if (endsAt > now) throw new HttpError(409, "You can report the result once the game is over");
  if (now.getTime() > endsAt.getTime() + REPORT_WINDOW_HOURS * HOUR) {
    throw new HttpError(409, `Results must be reported within ${REPORT_WINDOW_HOURS} hours of the game`);
  }

  checkSides(game, input, userId);

  try {
    const result = await prisma.matchResult.create({
      data: {
        gameId,
        reportedById: userId,
        score: formatScore(input.score),
        players: { create: sideRows(input) },
      },
      include: resultInclude,
    });
    res.status(201).json({ result: toResult(result) });
  } catch (err) {
    // Unique game_id: one result per game, even if two winners report at once.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A result has already been reported for this game');
    }
    throw err;
  }
});

// A loser confirms. Everything happens in one transaction: lock the result,
// re-check it, lock the winners, apply the guards, award points, level up.
resultsRouter.post('/results/:id/confirm', requireAuth, async (req, res) => {
  const resultId = uuidParam(req.params.id, 'Result');
  const userId = req.session.userId!;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM match_results WHERE id = ${resultId}::uuid FOR UPDATE`;
    const r = await tx.matchResult.findUnique({ where: { id: resultId }, include: { players: { include: { user: true } } } });
    if (!r) throw new HttpError(404, 'Result not found');
    if (r.status === 'pending' && now.getTime() - r.createdAt.getTime() > CONFIRM_WINDOW_HOURS * HOUR) {
      await tx.matchResult.update({ where: { id: r.id }, data: { status: 'expired', resolvedAt: now } });
      throw new HttpError(409, `This result expired: results must be confirmed within ${CONFIRM_WINDOW_HOURS} hours`);
    }
    if (r.status !== 'pending') throw new HttpError(409, `This result is already ${r.status}`);

    // Guard 3: the confirmer must be a real loser, and not the reporter.
    const me = r.players.find((p) => p.userId === userId);
    if (!me || me.side !== 'loser') throw new HttpError(403, 'Only a player on the losing side can confirm');
    if (r.reportedById === userId) throw new HttpError(403, "You can't confirm a result you reported");

    // Lock winners in a fixed (id) order: no deadlocks between transactions,
    // and the same-opponent count below can't race another confirmation.
    const winnerIds = r.players.filter((p) => p.side === 'winner').map((p) => p.userId).sort();
    await tx.$queryRaw`SELECT id FROM users WHERE id = ANY(${winnerIds}::uuid[]) ORDER BY id FOR UPDATE`;
    const winners = await tx.user.findMany({ where: { id: { in: winnerIds } } });
    const losers = r.players.filter((p) => p.side === 'loser').map((p) => p.user);

    const points = await pointsFor(tx, winners, losers, now);
    for (const w of winners) {
      const { points: p, note } = points.get(w.id)!;
      const leveledUpTo = p > 0 ? await addPoint(tx, w) : null;
      await tx.matchResultPlayer.update({
        where: { resultId_userId: { resultId: r.id, userId: w.id } },
        data: { points: p, pointsNote: note, leveledUpTo: leveledUpTo && toDbLevel(leveledUpTo) },
      });
    }
    await tx.matchResult.update({ where: { id: r.id }, data: { status: 'confirmed', confirmedById: userId, resolvedAt: now } });
    await tx.game.update({ where: { id: r.gameId }, data: { status: 'completed' } });
    return tx.matchResult.findUniqueOrThrow({ where: { id: r.id }, include: resultInclude });
  });

  res.json({ result: toResult(result) });
});

resultsRouter.post('/results/:id/dispute', requireAuth, async (req, res) => {
  const resultId = uuidParam(req.params.id, 'Result');
  const userId = req.session.userId!;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM match_results WHERE id = ${resultId}::uuid FOR UPDATE`;
    await expireStaleResults(tx);
    const r = await tx.matchResult.findUnique({ where: { id: resultId }, include: { players: true } });
    if (!r) throw new HttpError(404, 'Result not found');
    if (r.status !== 'pending') throw new HttpError(409, `This result is already ${r.status}`);
    const me = r.players.find((p) => p.userId === userId);
    if (!me || me.side !== 'loser') throw new HttpError(403, 'Only a player on the losing side can dispute');
    await tx.matchResult.update({ where: { id: r.id }, data: { status: 'disputed', resolvedAt: new Date() } });
    return tx.matchResult.findUniqueOrThrow({ where: { id: r.id }, include: resultInclude });
  });
  res.json({ result: toResult(result) });
});

// After a dispute, the players get one chance to agree: within 24 hours, a
// player on the (corrected) winning side reports the correct result: it can
// name different winners, a different score, or the same again. It goes back
// to pending, and the other side confirms (points as usual) or disputes again,
// which is final. The row is reused, keeping the disputed score for the record.
resultsRouter.post('/results/:id/correct', requireAuth, async (req, res) => {
  const resultId = uuidParam(req.params.id, 'Result');
  const input = reportResultSchema.parse(req.body);
  const userId = req.session.userId!;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM match_results WHERE id = ${resultId}::uuid FOR UPDATE`;
    const r = await tx.matchResult.findUnique({ where: { id: resultId }, include: { game: { include: { players: true } } } });
    if (!r) throw new HttpError(404, 'Result not found');
    if (r.status !== 'disputed') throw new HttpError(409, 'Only a disputed result can be corrected');
    if (r.correctedAt) throw new HttpError(409, 'This result was already corrected once and disputed again, so it stays disputed');
    if (!r.resolvedAt || now.getTime() > r.resolvedAt.getTime() + CORRECTION_WINDOW_HOURS * HOUR) {
      throw new HttpError(409, `Corrections must be reported within ${CORRECTION_WINDOW_HOURS} hours of the dispute`);
    }
    checkSides(r.game, input, userId);

    await tx.matchResultPlayer.deleteMany({ where: { resultId: r.id } });
    await tx.matchResult.update({
      where: { id: r.id },
      data: {
        reportedById: userId,
        score: formatScore(input.score),
        status: 'pending',
        // The confirm window starts over from the correction.
        createdAt: now,
        resolvedAt: null,
        confirmedById: null,
        correctedAt: now,
        originalScore: r.score,
        players: { create: sideRows(input) },
      },
    });
    return tx.matchResult.findUniqueOrThrow({ where: { id: r.id }, include: resultInclude });
  });
  res.json({ result: toResult(result) });
});

// Results waiting for *my* confirmation (I'm on the losing side).
resultsRouter.get('/results/pending', requireAuth, async (req, res) => {
  await expireStaleResults();
  const rows = await prisma.matchResult.findMany({
    where: { status: 'pending', players: { some: { userId: req.session.userId, side: 'loser' } } },
    include: resultInclude,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ results: rows.map(toResult) });
});

// Public match history: confirmed results only.
resultsRouter.get('/users/:id/results', async (req, res) => {
  const userId = uuidParam(req.params.id, 'Player');
  const rows = await prisma.matchResult.findMany({
    where: { status: 'confirmed', players: { some: { userId } } },
    include: resultInclude,
    orderBy: { resolvedAt: 'desc' },
    take: 20,
  });
  res.json({ results: rows.map(toResult) });
});
