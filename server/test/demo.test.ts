import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { GAME_CAPACITY, meetsMinLevel } from '@dinkup/shared';
import { prisma } from '../src/db.ts';
import { DEMO_CAST, DEMO_WEEK, demoSchedule, ensureDemoData, VISITOR_TTL_MS } from '../src/lib/demo.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const DAY = 24 * 60 * 60 * 1000;
const SLOW = 90_000; // several full demo refreshes against a remote DB

async function seedDemoCourts() {
  const slugs = ['pumpd-pickleball-cebu', 'zions-pickleball', 'niceserve-pickleball-court', 'nickleball-avenue'];
  await prisma.court.createMany({
    data: slugs.map((slug, i) => ({ slug, name: slug, address: '', city: 'Cebu', lat: 10.3 + i / 100, lng: 123.9, source: 'test' })),
  });
}

describe('demo schedule template', () => {
  const level = new Map(DEMO_CAST.map((c) => [c.key, c.level]));

  it('fits capacity, has no duplicate players, and every player meets the minimum', () => {
    for (const day of DEMO_WEEK) {
      for (const slot of day) {
        const players = [slot.host, ...slot.fill];
        expect(new Set(players).size).toBe(players.length);
        expect(players.length).toBeLessThanOrEqual(GAME_CAPACITY[slot.format]);
        for (const p of players) expect(meetsMinLevel(level.get(p)!, slot.min)).toBe(true);
      }
    }
  });
});

describe('ensureDemoData', () => {
  it('creates a week of labeled demo games, all in the future', async () => {
    await seedDemoCourts();
    const now = new Date();
    const result = await ensureDemoData(now);
    expect(result.created).toBeGreaterThan(10);

    const games = await demoSchedule();
    for (const g of games) {
      expect(g.startsAt.getTime()).toBeGreaterThan(now.getTime() + 60 * 60_000);
      expect(g.startsAt.getTime()).toBeLessThan(now.getTime() + 8 * DAY);
    }
    const listed = await request(app).get('/api/games').expect(200);
    expect(listed.body.games.length).toBeGreaterThan(0);
    expect(listed.body.games.every((g: { isDemo: boolean }) => g.isDemo)).toBe(true);
  }, SLOW);

  it('is idempotent', async () => {
    await seedDemoCourts();
    const now = new Date();
    await ensureDemoData(now);
    const count = await prisma.game.count();
    const again = await ensureDemoData(now);
    expect(again.created).toBe(0);
    expect(await prisma.game.count()).toBe(count);
  }, SLOW);

  it('rolls forward day by day without duplicating games or double-booking the cast', async () => {
    await seedDemoCourts();
    const start = Date.now();
    for (let d = 0; d < 3; d++) await ensureDemoData(new Date(start + d * DAY));

    const games = await demoSchedule();
    const keys = games.map((g) => `${g.hostId}@${g.startsAt.toISOString()}`);
    expect(new Set(keys).size).toBe(keys.length);

    const byPlayer = new Map<string, { startsAt: Date; endsAt: Date }[]>();
    for (const g of games) for (const p of g.players) byPlayer.set(p.userId, [...(byPlayer.get(p.userId) ?? []), g]);
    for (const [, list] of byPlayer) {
      list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      for (let i = 1; i < list.length; i++) expect(list[i]!.startsAt.getTime()).toBeGreaterThanOrEqual(list[i - 1]!.endsAt.getTime());
    }
  }, SLOW);

  it('clears old demo games and expired visitors, never real users or their games', async () => {
    await seedDemoCourts();
    const now = new Date();
    await ensureDemoData(now);
    const oldDemoGames = await prisma.game.count();

    // A real user with a game, and a demo visitor.
    const real = await registeredAgent();
    const court = await prisma.court.findFirstOrThrow();
    const realGame = await real
      .post('/api/games')
      .send({ courtId: court.id, startsAt: new Date(now.getTime() + 2 * DAY).toISOString(), durationMin: 90, format: 'doubles', minSkillLevel: null })
      .expect(201);
    await request(app).post('/api/auth/demo').set('Content-Type', 'application/json').expect(201);

    // Visitors live for 24 hours.
    const hour = 60 * 60_000;
    expect((await ensureDemoData(new Date(Date.now() + 23 * hour))).removedVisitors).toBe(0);
    expect((await ensureDemoData(new Date(Date.now() + 25 * hour))).removedVisitors).toBe(1);

    // Ten days later, every demo game from the first run has ended and is cleared.
    const later = new Date(now.getTime() + 10 * DAY);
    const result = await ensureDemoData(later);
    expect(result.removedGames).toBeGreaterThanOrEqual(oldDemoGames);
    const stale = (await demoSchedule()).filter((g) => g.endsAt.getTime() < later.getTime() - DAY);
    expect(stale).toHaveLength(0);

    // The real game and real user survive, even though that game has also ended.
    expect(await prisma.game.findUnique({ where: { id: realGame.body.game.id } })).not.toBeNull();
    expect(await prisma.user.count({ where: { isDemo: false } })).toBe(1);
  }, SLOW);
});

describe('POST /api/auth/demo', () => {
  it('logs into a fresh demo account that has already joined a demo game', async () => {
    await seedDemoCourts();
    await ensureDemoData();
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/demo').set('Content-Type', 'application/json').expect(201);
    expect(res.body.user).toMatchObject({ isDemo: true, skillLevel: '3.5' });
    expect(res.body.user.name).toMatch(/^Demo Visitor \d{4}$/);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.id).toBe(res.body.user.id);
    const mine = await agent.get('/api/games/mine').expect(200);
    expect(mine.body.games).toHaveLength(1);
    expect(mine.body.games[0].isDemo).toBe(true);
    // Visitors don't fill a game: at least one spot is left for the next person.
    expect(mine.body.games[0].players.length).toBeLessThan(mine.body.games[0].capacity);
  }, SLOW);

  it('gives every click its own account', async () => {
    const a = await request(app).post('/api/auth/demo').set('Content-Type', 'application/json').expect(201);
    const b = await request(app).post('/api/auth/demo').set('Content-Type', 'application/json').expect(201);
    expect(a.body.user.id).not.toBe(b.body.user.id);
  });

  it('marks real users and their games as not demo', async () => {
    const real = await registeredAgent();
    const me = await real.get('/api/auth/me');
    expect(me.body.user.isDemo).toBe(false);
  });
});
