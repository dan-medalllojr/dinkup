import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import type { GameFormat, SkillLevel } from '../src/generated/prisma/client.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const JSON_HEADER = ['Content-Type', 'application/json'] as const;
let seq = 0;

type Player = { id: string; agent: request.Agent };

/** A logged-in player; established = old enough with 3 confirmed results (passes guard 4). */
async function player(level = '3.5', { established = true, daysOld = 30 } = {}): Promise<Player> {
  const n = ++seq;
  const agent = await registeredAgent({ name: `Player ${n}`, email: `p${n}@example.com`, skillLevel: level });
  const id = (await agent.get('/api/auth/me')).body.user.id as string;
  await prisma.user.update({ where: { id }, data: { createdAt: new Date(Date.now() - daysOld * DAY) } });
  if (established) await history(id, 3);
  return { id, agent };
}

// Cached per test: the database (courts included) is wiped before each one.
let court: { id: string } | null = null;
beforeEach(() => {
  court = null;
});
async function courtId() {
  court ??= await prisma.court.create({ data: { slug: `c${++seq}`, name: 'Court', address: '', city: 'Cebu', lat: 10.3, lng: 123.9, source: 'test' } });
  return court.id;
}

/** A game that ended `endedHoursAgo` ago, everyone joined a day before it started. */
async function finishedGame(players: Player[], { format = players.length === 2 ? 'singles' : 'doubles', endedHoursAgo = 1 }: { format?: GameFormat; endedHoursAgo?: number } = {}) {
  const startsAt = new Date(Date.now() - endedHoursAgo * HOUR - 90 * 60_000);
  return prisma.game.create({
    data: {
      hostId: players[0]!.id,
      courtId: await courtId(),
      startsAt,
      durationMin: 90,
      format,
      capacity: format === 'singles' ? 2 : 4,
      players: { create: players.map((p) => ({ userId: p.id, joinedAt: new Date(startsAt.getTime() - DAY) })) },
    },
  });
}

/** n confirmed results for a user (as a loser vs filler players), so they count as established. */
async function history(userId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const filler = await prisma.user.create({ data: { name: 'Filler', email: `f${++seq}@example.com`, passwordHash: 'x' } });
    const game = await prisma.game.create({
      data: { hostId: filler.id, courtId: await courtId(), startsAt: new Date(Date.now() - 200 * DAY), durationMin: 60, format: 'singles', capacity: 2, status: 'completed' },
    });
    await prisma.matchResult.create({
      data: {
        gameId: game.id, reportedById: filler.id, score: '11-0', status: 'confirmed', resolvedAt: new Date(Date.now() - 200 * DAY),
        players: { create: [{ userId: filler.id, side: 'winner' }, { userId, side: 'loser' }] },
      },
    });
  }
}

const report = (by: Player, gameId: string, winners: Player[], losers: Player[], score: [number, number][] = [[11, 7], [11, 9]]) =>
  by.agent.post(`/api/games/${gameId}/result`).send({ winnerIds: winners.map((p) => p.id), loserIds: losers.map((p) => p.id), score });
const confirm = (by: Player, resultId: string) => by.agent.post(`/api/results/${resultId}/confirm`).set(...JSON_HEADER);
const user = (p: Player) => prisma.user.findUniqueOrThrow({ where: { id: p.id } });

async function playAndConfirm(winners: Player[], losers: Player[]) {
  const game = await finishedGame([...winners, ...losers]);
  const r = await report(winners[0]!, game.id, winners, losers).expect(201);
  return confirm(losers[0]!, r.body.result.id).expect(200);
}

describe('reporting a result', () => {
  it('lets a winner report a finished game; it waits 48 h for confirmation', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    const res = await report(a, game.id, [a], [b], [[11, 7], [9, 11], [11, 5]]).expect(201);
    expect(res.body.result).toMatchObject({ status: 'pending', score: '11-7, 9-11, 11-5', reportedBy: { id: a.id } });
    expect(new Date(res.body.result.confirmBy).getTime() - new Date(res.body.result.createdAt).getTime()).toBe(48 * HOUR);
  });

  it('only after the game ends, and within 24 hours', async () => {
    const [a, b] = [await player(), await player()];
    const notOver = await finishedGame([a, b], { endedHoursAgo: -1 });
    expect((await report(a, notOver.id, [a], [b]).expect(409)).body.error).toMatch(/once the game is over/);
    const stale = await finishedGame([a, b], { endedHoursAgo: 25 });
    expect((await report(a, stale.id, [a], [b]).expect(409)).body.error).toMatch(/within 24 hours/);
  });

  it('only by a winner, with exactly the game\'s players on the right-sized sides', async () => {
    const [a, b, c, d] = [await player(), await player(), await player(), await player()];
    const singles = await finishedGame([a, b]);
    expect((await report(b, singles.id, [a], [b]).expect(403)).body.error).toMatch(/winning side/);
    await report(a, singles.id, [a], [c]).expect(400); // c isn't in the game
    const doubles = await finishedGame([a, b, c, d]);
    await report(a, doubles.id, [a], [b]).expect(400); // 1v1 in a doubles game
    await report(a, doubles.id, [a, b], [a, c]).expect(400); // a on both sides
    await report(a, doubles.id, [a, b], [c, d]).expect(201);
  });

  it('rejects players who joined after the start, cancelled games, and second reports', async () => {
    const [a, b] = [await player(), await player()];
    const late = await finishedGame([a, b]);
    await prisma.gamePlayer.update({ where: { gameId_userId: { gameId: late.id, userId: b.id } }, data: { joinedAt: new Date() } });
    expect((await report(a, late.id, [a], [b]).expect(409)).body.error).toMatch(/joined before the start/);

    const cancelled = await finishedGame([a, b]);
    await prisma.game.update({ where: { id: cancelled.id }, data: { status: 'cancelled' } });
    await report(a, cancelled.id, [a], [b]).expect(409);

    const once = await finishedGame([a, b]);
    await report(a, once.id, [a], [b]).expect(201);
    expect((await report(a, once.id, [a], [b]).expect(409)).body.error).toMatch(/already been reported/);
  });

  it('validates the score', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    await report(a, game.id, [a], [b], [[11, 10]]).expect(400); // not won by 2
    await report(a, game.id, [a], [b], [[9, 7]]).expect(400); // below 11
    await report(a, game.id, [a], [b], [[7, 11], [7, 11]]).expect(400); // winners lost
    await report(a, game.id, [a], [b], []).expect(400);
  });
});

describe('confirming: who can, and the points', () => {
  it('awards a point when a loser confirms, and completes the game', async () => {
    const [a, b] = [await player(), await player()];
    const res = await playAndConfirm([a], [b]);
    expect(res.body.result.status).toBe('confirmed');
    expect(res.body.result.winners[0]).toMatchObject({ id: a.id, points: 1, pointsNote: 'awarded' });
    expect((await user(a)).skillPoints).toBe(1);
    expect((await user(b)).skillPoints).toBe(0);
    expect((await prisma.game.findFirstOrThrow({ where: { result: { id: res.body.result.id } } })).status).toBe('completed');
  });

  it('refuses confirmation from winners (including the reporter) and outsiders', async () => {
    const [a, b, c, d, x] = [await player(), await player(), await player(), await player(), await player()];
    const game = await finishedGame([a, b, c, d]);
    const r = await report(a, game.id, [a, b], [c, d]).expect(201);
    expect((await confirm(a, r.body.result.id).expect(403)).body.error).toMatch(/losing side/);
    await confirm(b, r.body.result.id).expect(403);
    await confirm(x, r.body.result.id).expect(403);
    await confirm(c, r.body.result.id).expect(200);
  });

  it('gives nothing for beating a lower level; doubles use the losing pair\'s average', async () => {
    const strong = await player('4.0');
    const weak = await player('3.0');
    const res = await playAndConfirm([strong], [weak]);
    expect(res.body.result.winners[0]).toMatchObject({ points: 0, pointsNote: 'lower_level' });

    // Losers 3.0 + 4.0 average 3.5: worth a point to a 3.5, not to a 4.0.
    const [w35, w40, l30, l40] = [await player('3.5'), await player('4.0'), await player('3.0'), await player('4.0')];
    const d = await playAndConfirm([w35, w40], [l30, l40]);
    const byId = Object.fromEntries(d.body.result.winners.map((w: { id: string; pointsNote: string }) => [w.id, w.pointsNote]));
    expect(byId).toEqual({ [w35.id]: 'awarded', [w40.id]: 'lower_level' });
  });

  it('gives nothing against a new or unproven opponent account (guard 4)', async () => {
    const a = await player();
    const fresh = await player('3.5', { daysOld: 3 });
    expect((await playAndConfirm([a], [fresh])).body.result.winners[0].pointsNote).toBe('new_opponent');

    const oldButUnproven = await player('3.5', { established: false, daysOld: 60 });
    await history(oldButUnproven.id, 2); // one short of 3
    expect((await playAndConfirm([a], [oldButUnproven])).body.result.winners[0].pointsNote).toBe('new_opponent');
  });

  it('counts only 2 wins over the same opponent in 30 days (guard 2)', async () => {
    const [a, b] = [await player(), await player()];
    expect((await playAndConfirm([a], [b])).body.result.winners[0].points).toBe(1);
    expect((await playAndConfirm([a], [b])).body.result.winners[0].points).toBe(1);
    const third = await playAndConfirm([a], [b]);
    expect(third.body.result.winners[0]).toMatchObject({ points: 0, pointsNote: 'opponent_cap' });
    expect((await user(a)).skillPoints).toBe(2);

    // Once those wins are older than 30 days, wins count again.
    await prisma.matchResult.updateMany({ where: { status: 'confirmed', players: { some: { userId: a.id, side: 'winner' } } }, data: { resolvedAt: new Date(Date.now() - 31 * DAY) } });
    expect((await playAndConfirm([a], [b])).body.result.winners[0].points).toBe(1);
  });
});

describe('leveling', () => {
  it('levels up at 5 points and resets to 0', async () => {
    const a = await player('3.5');
    await prisma.user.update({ where: { id: a.id }, data: { skillPoints: 4 } });
    const res = await playAndConfirm([a], [await player('3.5')]);
    expect(res.body.result.winners[0]).toMatchObject({ points: 1, leveledUpTo: '4.0' });
    expect(await user(a)).toMatchObject({ skillLevel: 'L4_0', skillPoints: 0 });
  });

  it('stops at 5 points on the top level', async () => {
    const top = await player('5.0');
    await prisma.user.update({ where: { id: top.id }, data: { skillPoints: 5 } });
    const res = await playAndConfirm([top], [await player('5.0')]);
    expect(res.body.result.winners[0]).toMatchObject({ points: 1, leveledUpTo: null });
    expect(await user(top)).toMatchObject({ skillLevel: 'L5_0', skillPoints: 5 });
  });

  it('locks the self-set level after the first confirmed result', async () => {
    const [a, b] = [await player('3.5', { established: false }), await player()];
    await a.agent.patch('/api/users/me').send({ skillLevel: '4.0' }).expect(200); // still a self-assessment
    await a.agent.patch('/api/users/me').send({ skillLevel: '3.5' }).expect(200);
    await playAndConfirm([b], [a]);
    expect((await a.agent.patch('/api/users/me').send({ skillLevel: '4.5' }).expect(403)).body.error).toMatch(/set by confirmed results/);
    await a.agent.patch('/api/users/me').send({ name: 'Still Editable' }).expect(200);
  });
});

describe('expiry and disputes', () => {
  it('expires results not confirmed within 48 hours (time limit, guard 5)', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    const r = await report(a, game.id, [a], [b]).expect(201);
    await prisma.matchResult.update({ where: { id: r.body.result.id }, data: { createdAt: new Date(Date.now() - 49 * HOUR) } });
    expect((await confirm(b, r.body.result.id).expect(409)).body.error).toMatch(/expired/);
    const shown = await request(app).get(`/api/games/${game.id}`).expect(200);
    expect(shown.body.game.result.status).toBe('expired');
    expect((await user(a)).skillPoints).toBe(0);
  });

  it('lets a loser dispute; disputed results earn nothing and stay closed', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    const r = await report(a, game.id, [a], [b]).expect(201);
    await a.agent.post(`/api/results/${r.body.result.id}/dispute`).set(...JSON_HEADER).expect(403);
    const d = await b.agent.post(`/api/results/${r.body.result.id}/dispute`).set(...JSON_HEADER).expect(200);
    expect(d.body.result.status).toBe('disputed');
    await confirm(b, r.body.result.id).expect(409);
    expect((await user(a)).skillPoints).toBe(0);
  });
});

const dispute = (by: Player, resultId: string) => by.agent.post(`/api/results/${resultId}/dispute`).set(...JSON_HEADER);
const correct = (by: Player, resultId: string, winners: Player[], losers: Player[], score: [number, number][] = [[11, 8], [11, 6]]) =>
  by.agent.post(`/api/results/${resultId}/correct`).send({ winnerIds: winners.map((p) => p.id), loserIds: losers.map((p) => p.id), score });

describe('correcting a disputed result', () => {
  it('lets the real winners report a correction, which the other side confirms for points', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    // a claims a win; b disputes; b actually won and reports that.
    const r = await report(a, game.id, [a], [b]).expect(201);
    const d = await dispute(b, r.body.result.id).expect(200);
    expect(d.body.result.correctableUntil).toBeTruthy();
    const c = await correct(b, r.body.result.id, [b], [a]).expect(200);
    expect(c.body.result).toMatchObject({ status: 'pending', score: '11-8, 11-6', correction: { originalScore: '11-7, 11-9' }, correctableUntil: null });
    expect(c.body.result.winners.map((w: { id: string }) => w.id)).toEqual([b.id]);
    expect(c.body.result.reportedBy.id).toBe(b.id);

    // Now a is the loser: the reporter (b) can't confirm, a can.
    await confirm(b, r.body.result.id).expect(403);
    const done = await confirm(a, r.body.result.id).expect(200);
    expect(done.body.result.status).toBe('confirmed');
    expect((await user(b)).skillPoints).toBe(1);
    expect((await user(a)).skillPoints).toBe(0);
  });

  it('allows only one correction: disputing it again is final', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    const r = await report(a, game.id, [a], [b]).expect(201);
    await dispute(b, r.body.result.id).expect(200);
    // The original reporter re-asserts the same win (allowed once)…
    await correct(a, r.body.result.id, [a], [b], [[11, 7], [11, 9]]).expect(200);
    // …b disputes again, and that's the end of it.
    const d2 = await dispute(b, r.body.result.id).expect(200);
    expect(d2.body.result.correctableUntil).toBeNull();
    const again = await correct(b, r.body.result.id, [b], [a]).expect(409);
    expect(again.body.error).toMatch(/already corrected once/);
    expect((await user(a)).skillPoints).toBe(0);
  });

  it('only for disputed results, within 24 hours, by a player on the corrected winning side', async () => {
    const [a, b, outsider] = [await player(), await player(), await player()];
    const game = await finishedGame([a, b]);
    const r = await report(a, game.id, [a], [b]).expect(201);
    await correct(a, r.body.result.id, [a], [b]).expect(409); // still pending, not disputed
    await dispute(b, r.body.result.id).expect(200);

    await correct(outsider, r.body.result.id, [outsider], [b]).expect(400); // not this game's players
    await correct(a, r.body.result.id, [b], [a]).expect(403); // a can't report b's win
    await correct(b, r.body.result.id, [b], [a], [[5, 11]]).expect(400); // bad score

    await prisma.matchResult.update({ where: { id: r.body.result.id }, data: { resolvedAt: new Date(Date.now() - 25 * HOUR) } });
    const late = await correct(b, r.body.result.id, [b], [a]).expect(409);
    expect(late.body.error).toMatch(/within 24 hours/);
  });

  it('works for doubles, including a different partner split', async () => {
    const [a, b, c, d] = [await player(), await player(), await player(), await player()];
    const game = await finishedGame([a, b, c, d]);
    const r = await report(a, game.id, [a, b], [c, d]).expect(201);
    await dispute(c, r.body.result.id).expect(200);
    // The teams were actually a+c vs b+d.
    const fixed = await correct(c, r.body.result.id, [c, a], [b, d]).expect(200);
    expect(fixed.body.result.losers.map((p: { id: string }) => p.id).sort()).toEqual([b.id, d.id].sort());
    await confirm(a, r.body.result.id).expect(403); // a is a winner now
    await confirm(d, r.body.result.id).expect(200);
    expect((await user(a)).skillPoints).toBe(1);
    expect((await user(c)).skillPoints).toBe(1);
  });
});

describe('concurrency', () => {
  it('counts a doubles result once when both losers confirm at the same moment', async () => {
    const [a, b, c, d] = [await player(), await player(), await player(), await player()];
    const game = await finishedGame([a, b, c, d]);
    const r = await report(a, game.id, [a, b], [c, d]).expect(201);
    const results = await Promise.all([confirm(c, r.body.result.id), confirm(d, r.body.result.id)]);
    expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
    expect((await user(a)).skillPoints).toBe(1);
    expect((await user(b)).skillPoints).toBe(1);
  });

  it('keeps the same-opponent cap when two wins are confirmed at the same moment', async () => {
    const [a, b] = [await player(), await player()];
    await playAndConfirm([a], [b]); // 1 prior win → only one more may count
    const g1 = await finishedGame([a, b]);
    const g2 = await finishedGame([a, b], { endedHoursAgo: 3 });
    const r1 = await report(a, g1.id, [a], [b]).expect(201);
    const r2 = await report(a, g2.id, [a], [b]).expect(201);
    const [c1, c2] = await Promise.all([confirm(b, r1.body.result.id).expect(200), confirm(b, r2.body.result.id).expect(200)]);
    // Check what each result recorded, not just the total: without the lock
    // both award a point AND the second write overwrites the first ("lost
    // update"), so the total alone can still look right.
    const awarded = [c1, c2].map((c) => c.body.result.winners[0].points).sort();
    expect(awarded).toEqual([0, 1]);
    expect([c1, c2].map((c) => c.body.result.winners[0].pointsNote).sort()).toEqual(['awarded', 'opponent_cap']);
    expect((await user(a)).skillPoints).toBe(2);
  });
});

describe('listing results', () => {
  it('shows a loser their pending confirmations, and anyone a player\'s confirmed history', async () => {
    const [a, b] = [await player(), await player()];
    const game = await finishedGame([a, b]);
    const r = await report(a, game.id, [a], [b]).expect(201);
    expect((await b.agent.get('/api/results/pending').expect(200)).body.results.map((x: { id: string }) => x.id)).toEqual([r.body.result.id]);
    expect((await a.agent.get('/api/results/pending').expect(200)).body.results).toEqual([]); // the winner has nothing to confirm
    await confirm(b, r.body.result.id).expect(200);
    const hist = await request(app).get(`/api/users/${a.id}/results`).expect(200);
    expect(hist.body.results[0]).toMatchObject({ id: r.body.result.id, status: 'confirmed', game: { format: 'singles' } });
    expect(JSON.stringify(hist.body)).not.toMatch(/@example\.com/);
  });
});
