import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const HOUR = 60 * 60 * 1000;
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

async function createCourt(name = 'Test Court') {
  return prisma.court.create({
    data: { slug: name.toLowerCase().replace(/\W+/g, '-'), name, address: '1 Test St', city: 'Cebu City', lat: 10.3, lng: 123.9, source: 'test' },
  });
}

// Not async: returns the supertest Test so callers can chain .expect().
function postGame(agent: request.Agent, courtId: string, overrides: Record<string, unknown> = {}) {
  return agent.post('/api/games').send({
    courtId,
    startsAt: hoursFromNow(24),
    durationMin: 90,
    format: 'doubles',
    minSkillLevel: null,
    ...overrides,
  });
}

describe('POST /api/games', () => {
  it('requires login', async () => {
    const court = await createCourt();
    await postGame(request.agent(app), court.id).expect(401);
  });

  it('creates a game with the host as the first player', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const res = await postGame(host, court.id, { minSkillLevel: '3.5' }).expect(201);

    expect(res.body.game).toMatchObject({
      format: 'doubles',
      capacity: 4,
      durationMin: 90,
      minSkillLevel: '3.5',
      status: 'open',
      court: { name: 'Test Court' },
      host: { name: 'Ana Reyes' },
    });
    expect(res.body.game.players).toHaveLength(1);
    expect(res.body.game.players[0].id).toBe(res.body.game.host.id);
    expect(new Date(res.body.game.endsAt).getTime() - new Date(res.body.game.startsAt).getTime()).toBe(90 * 60_000);
  });

  it('derives capacity from the format, ignoring any capacity sent', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const res = await postGame(host, court.id, { format: 'singles', capacity: 10 }).expect(201);
    expect(res.body.game.capacity).toBe(2);
  });

  it('accepts a Manila-time offset and stores the right instant', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const tomorrow = new Date(Date.now() + 24 * HOUR);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(tomorrow);
    const res = await postGame(host, court.id, { startsAt: `${date}T18:30:00+08:00` }).expect(201);
    // 18:30 in Manila is 10:30 UTC.
    expect(res.body.game.startsAt).toBe(`${date}T10:30:00.000Z`);
  });

  it('rejects start times in the past or too far ahead', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const past = await postGame(host, court.id, { startsAt: hoursFromNow(-1) }).expect(400);
    expect(past.body.fields.startsAt[0]).toMatch(/future/);
    const far = await postGame(host, court.id, { startsAt: hoursFromNow(24 * 61) }).expect(400);
    expect(far.body.fields.startsAt[0]).toMatch(/60 days/);
  });

  it('rejects invalid durations, formats, and levels', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    await postGame(host, court.id, { durationMin: 95 }).expect(400);
    await postGame(host, court.id, { durationMin: 600 }).expect(400);
    await postGame(host, court.id, { format: 'triples' }).expect(400);
    await postGame(host, court.id, { minSkillLevel: '9.0' }).expect(400);
  });

  it('404s for a court that does not exist', async () => {
    const host = await registeredAgent();
    await postGame(host, '00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('blocks hosting two games that overlap in time', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    await postGame(host, court.id, { startsAt: hoursFromNow(24), durationMin: 120 }).expect(201);

    // Starts 1h into the 2h game.
    const clash = await postGame(host, court.id, { startsAt: hoursFromNow(25) }).expect(409);
    expect(clash.body.error).toMatch(/already playing at Test Court/);

    // Back-to-back is fine: starts exactly when the first one ends.
    await postGame(host, court.id, { startsAt: hoursFromNow(26) }).expect(201);
  });

  it('allows re-using a time slot after cancelling the game in it', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const first = await postGame(host, court.id).expect(201);
    await host.post(`/api/games/${first.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(200);
    await postGame(host, court.id).expect(201);
  });

  it('caps upcoming hosted games at 5', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    for (let day = 1; day <= 5; day++) {
      await postGame(host, court.id, { startsAt: hoursFromNow(24 * day) }).expect(201);
    }
    const res = await postGame(host, court.id, { startsAt: hoursFromNow(24 * 6) }).expect(409);
    expect(res.body.error).toMatch(/up to 5/);
  });

  it('lets only one of two simultaneous overlapping posts through', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const results = await Promise.all([
      postGame(host, court.id, { startsAt: hoursFromNow(48) }),
      postGame(host, court.id, { startsAt: hoursFromNow(48.5) }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.game.count()).toBe(1);
  });
});

describe('GET /api/games/:id', () => {
  it('is public and never exposes player emails', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const created = await postGame(host, court.id).expect(201);

    const res = await request(app).get(`/api/games/${created.body.game.id}`).expect(200);
    expect(res.body.game.id).toBe(created.body.game.id);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });

  it('404s for unknown or malformed ids', async () => {
    await request(app).get('/api/games/00000000-0000-4000-8000-000000000000').expect(404);
    await request(app).get('/api/games/nope').expect(404);
  });
});

describe('POST /api/games/:id/cancel', () => {
  it('lets the host cancel', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const created = await postGame(host, court.id).expect(201);
    const res = await host.post(`/api/games/${created.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(200);
    expect(res.body.game.status).toBe('cancelled');
    await host.post(`/api/games/${created.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(409);
  });

  it('refuses anyone who is not the host', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const created = await postGame(host, court.id).expect(201);
    const other = await registeredAgent({ email: 'ben@example.com', name: 'Ben Cruz' });
    await other.post(`/api/games/${created.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(403);
    await request(app).post(`/api/games/${created.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(401);
  });
});

describe('database constraints', () => {
  it('rejects a capacity that does not match the format, even bypassing the API', async () => {
    const court = await createCourt();
    const host = await registeredAgent();
    const me = await host.get('/api/auth/me');
    await expect(
      prisma.game.create({
        data: { hostId: me.body.user.id, courtId: court.id, startsAt: new Date(Date.now() + HOUR), durationMin: 90, format: 'singles', capacity: 4 },
      }),
    ).rejects.toThrow(/games_capacity_matches_format/);
  });
});
