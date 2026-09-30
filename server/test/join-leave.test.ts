import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const HOUR = 60 * 60 * 1000;
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const JSON_HEADER = ['Content-Type', 'application/json'] as const;
let seq = 0;

async function createCourt() {
  return prisma.court.create({
    data: { slug: `court-${++seq}`, name: `Court ${seq}`, address: '', city: 'Cebu City', lat: 10.3, lng: 123.9, source: 'test' },
  });
}

async function player(skillLevel = '3.5') {
  const n = ++seq;
  return registeredAgent({ name: `Player ${n}`, email: `player${n}@example.com`, skillLevel });
}

async function hostGame(overrides: Record<string, unknown> = {}) {
  const court = await createCourt();
  const host = await player();
  const res = await host
    .post('/api/games')
    .send({ courtId: court.id, startsAt: hoursFromNow(24), durationMin: 90, format: 'doubles', minSkillLevel: null, ...overrides })
    .expect(201);
  return { host, court, gameId: res.body.game.id as string };
}

const join = (agent: request.Agent, gameId: string) => agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER);
const leave = (agent: request.Agent, gameId: string) => agent.post(`/api/games/${gameId}/leave`).set(...JSON_HEADER);

describe('POST /api/games/:id/join', () => {
  it('requires login', async () => {
    const { gameId } = await hostGame();
    await request(app).post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(401);
  });

  it('adds the player and marks the game full on the last spot', async () => {
    const { gameId } = await hostGame({ format: 'singles' });
    const res = await join(await player(), gameId).expect(200);
    expect(res.body.game.players).toHaveLength(2);
    expect(res.body.game.status).toBe('full');
  });

  it('refuses a full game', async () => {
    const { gameId } = await hostGame({ format: 'singles' });
    await join(await player(), gameId).expect(200);
    const res = await join(await player(), gameId).expect(409);
    expect(res.body.error).toMatch(/full/);
  });

  it('refuses joining twice, including the host', async () => {
    const { host, gameId } = await hostGame();
    const p = await player();
    await join(p, gameId).expect(200);
    await join(p, gameId).expect(409);
    await join(host, gameId).expect(409);
  });

  it('blocks players below the minimum level, allows those at or above it', async () => {
    const { gameId } = await hostGame({ minSkillLevel: '3.5' });
    const low = await join(await player('3.0'), gameId).expect(403);
    expect(low.body.error).toBe("This game is for 3.5+ players, and you're 3.0");
    await join(await player('3.5'), gameId).expect(200);
    await join(await player('4.5'), gameId).expect(200);
  });

  it('refuses cancelled and already-started games', async () => {
    const { host, gameId } = await hostGame();
    await host.post(`/api/games/${gameId}/cancel`).set(...JSON_HEADER).expect(200);
    expect((await join(await player(), gameId).expect(409)).body.error).toMatch(/cancelled/);

    const started = await hostGame();
    await prisma.game.update({ where: { id: started.gameId }, data: { startsAt: new Date(Date.now() - 10 * 60_000) } });
    expect((await join(await player(), started.gameId).expect(409)).body.error).toMatch(/already started/);
  });

  it('refuses a game that overlaps one the player already joined', async () => {
    const a = await hostGame({ startsAt: hoursFromNow(24) });
    const b = await hostGame({ startsAt: hoursFromNow(25) });
    const p = await player();
    await join(p, a.gameId).expect(200);
    const res = await join(p, b.gameId).expect(409);
    expect(res.body.error).toMatch(/already playing/);
  });

  it('404s for unknown games', async () => {
    await join(await player(), '00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('gives the last spot to exactly one of two simultaneous joiners', async () => {
    const { gameId } = await hostGame({ format: 'singles' });
    const [a, b] = [await player(), await player()];
    const results = await Promise.all([join(a, gameId), join(b, gameId)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.gamePlayer.count({ where: { gameId } })).toBe(2);
  });

  it('lets one player into only one of two overlapping games joined at once', async () => {
    const a = await hostGame({ startsAt: hoursFromNow(48) });
    const b = await hostGame({ startsAt: hoursFromNow(48.5) });
    const p = await player();
    const results = await Promise.all([join(p, a.gameId), join(p, b.gameId)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe('POST /api/games/:id/leave', () => {
  it('removes the player and reopens the spot', async () => {
    const { gameId } = await hostGame({ format: 'singles' });
    const p = await player();
    await join(p, gameId).expect(200);
    const res = await leave(p, gameId).expect(200);
    expect(res.body.game.players).toHaveLength(1);
    expect(res.body.game.status).toBe('open');
    // And they can come back.
    await join(p, gameId).expect(200);
  });

  it("doesn't let the host leave their own game", async () => {
    const { host, gameId } = await hostGame();
    const res = await leave(host, gameId).expect(409);
    expect(res.body.error).toMatch(/Cancel it instead/);
  });

  it('refuses players who are not in the game', async () => {
    const { gameId } = await hostGame();
    await leave(await player(), gameId).expect(409);
  });

  it('refuses leaving after the game started', async () => {
    const { gameId } = await hostGame();
    const p = await player();
    await join(p, gameId).expect(200);
    await prisma.game.update({ where: { id: gameId }, data: { startsAt: new Date(Date.now() - 10 * 60_000) } });
    await leave(p, gameId).expect(409);
  });
});

describe('GET /api/games/mine', () => {
  it("lists games I'm hosting or playing in, including cancelled ones, not others'", async () => {
    const hosted = await hostGame({ startsAt: hoursFromNow(24) });
    const joined = await hostGame({ startsAt: hoursFromNow(48) });
    await hostGame({ startsAt: hoursFromNow(72) }); // someone else's

    // The first host joins the second game, and the second host cancels it.
    await join(hosted.host, joined.gameId).expect(200);
    await joined.host.post(`/api/games/${joined.gameId}/cancel`).set(...JSON_HEADER).expect(200);

    const res = await hosted.host.get('/api/games/mine').expect(200);
    expect(res.body.games.map((g: { id: string; status: string }) => [g.id, g.status])).toEqual([
      [hosted.gameId, 'open'],
      [joined.gameId, 'cancelled'],
    ]);
  });

  it('requires login', async () => {
    await request(app).get('/api/games/mine').expect(401);
  });
});
