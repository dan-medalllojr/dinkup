import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

let seq = 0;
const player = () => {
  const n = ++seq;
  return registeredAgent({ name: `Player ${n}`, email: `player${n}@example.com` });
};
// Cebu City, well inside the bounds.
const spot = (dLat = 0, dLng = 0) => ({ lat: 10.3157 + dLat, lng: 123.8854 + dLng });

describe('POST /api/courts', () => {
  it('lets a player add a court everyone can see, labeled with who added it', async () => {
    const ana = await player();
    const res = await ana.post('/api/courts').send({ name: '  Barangay Lahug Court ', address: 'Gorordo Ave', city: 'Cebu City', ...spot() }).expect(201);
    expect(res.body.court).toMatchObject({ name: 'Barangay Lahug Court', city: 'Cebu City', addedBy: { name: 'Player 1' }, upcomingGames: 0 });

    const list = await request(app).get('/api/courts').expect(200);
    expect(list.body.courts.map((c: { name: string }) => c.name)).toContain('Barangay Lahug Court');
    expect(JSON.stringify(list.body)).not.toMatch(/@example\.com/);
  });

  it('requires login and blocks demo accounts', async () => {
    await request(app).post('/api/courts').send({ name: 'X Court', ...spot() }).expect(401);
    const demo = request.agent(app);
    await demo.post('/api/auth/demo').set('Content-Type', 'application/json').expect(201);
    const res = await demo.post('/api/courts').send({ name: 'Demo Court', ...spot() }).expect(403);
    expect(res.body.error).toMatch(/Sign up/);
  });

  it('only accepts courts in Cebu', async () => {
    const ana = await player();
    const manila = await ana.post('/api/courts').send({ name: 'Manila Court', lat: 14.5995, lng: 120.9842 }).expect(400);
    expect(manila.body.fields.lat[0]).toMatch(/Cebu/);
    await ana.post('/api/courts').send({ name: 'Bantayan Court', lat: 11.17, lng: 123.72 }).expect(201);
  });

  it('rejects a court within 50 m of an existing one, pointing at it', async () => {
    const ana = await player();
    const first = await ana.post('/api/courts').send({ name: 'Original Court', ...spot() }).expect(201);
    // ~22 m north.
    const dupe = await ana.post('/api/courts').send({ name: 'Copy Court', ...spot(0.0002) }).expect(409);
    expect(dupe.body).toMatchObject({ existingCourtId: first.body.court.id });
    expect(dupe.body.error).toMatch(/Original Court/);
    // ~110 m away is a different court.
    await ana.post('/api/courts').send({ name: 'Neighbor Court', ...spot(0.001) }).expect(201);
  });

  it('caps each player at 5 new courts a day', async () => {
    const ana = await player();
    for (let i = 1; i <= 5; i++) await ana.post('/api/courts').send({ name: `Court ${i}`, ...spot(i * 0.01) }).expect(201);
    const res = await ana.post('/api/courts').send({ name: 'Court 6', ...spot(0.06) }).expect(429);
    expect(res.body.error).toMatch(/5 courts a day/);
  });

  it('validates the name', async () => {
    const ana = await player();
    await ana.post('/api/courts').send({ name: 'ab', ...spot() }).expect(400);
    await ana.post('/api/courts').send({ ...spot() }).expect(400);
  });
});

describe('PATCH /api/courts/:id', () => {
  it('lets the player who added it fix the name and pin, nobody else', async () => {
    const ana = await player();
    const ben = await player();
    const created = await ana.post('/api/courts').send({ name: 'Typo Cuort', ...spot() }).expect(201);
    const url = `/api/courts/${created.body.court.id}`;

    await ben.patch(url).send({ name: 'Hijacked' }).expect(403);
    const fixed = await ana.patch(url).send({ name: 'Typo Court', ...spot(0.0005) }).expect(200);
    expect(fixed.body.court).toMatchObject({ name: 'Typo Court', lat: spot(0.0005).lat });

    await ana.patch(url).send({ lat: 10.4 }).expect(400); // lat without lng
    await ana.patch(url).send({ lat: 14.6, lng: 121 }).expect(400); // outside Cebu
    await ana.patch(url).send({ addedById: null }).expect(400); // not editable
  });

  it("doesn't let anyone edit curated courts", async () => {
    const ana = await player();
    const curated = await prisma.court.create({ data: { slug: 'curated', name: 'Curated', address: '', city: '', ...spot(), source: 'test' } });
    await ana.patch(`/api/courts/${curated.id}`).send({ name: 'Mine now' }).expect(403);
  });
});

describe('court game counts and filter', () => {
  it('counts upcoming open games per court and filters games by court', async () => {
    const ana = await player();
    const a = (await ana.post('/api/courts').send({ name: 'Court A', ...spot() }).expect(201)).body.court.id;
    const b = (await ana.post('/api/courts').send({ name: 'Court B', ...spot(0.01) }).expect(201)).body.court.id;
    const post = (courtId: string, hours: number) =>
      ana.post('/api/games').send({ courtId, startsAt: new Date(Date.now() + hours * 3600_000).toISOString(), durationMin: 60, format: 'singles', minSkillLevel: null });
    await post(a, 24).expect(201);
    await post(a, 48).expect(201);
    const cancelled = await post(b, 72).expect(201);
    await ana.post(`/api/games/${cancelled.body.game.id}/cancel`).set('Content-Type', 'application/json').expect(200);

    const courts = (await request(app).get('/api/courts').expect(200)).body.courts as { id: string; upcomingGames: number }[];
    expect(courts.find((c) => c.id === a)?.upcomingGames).toBe(2);
    expect(courts.find((c) => c.id === b)?.upcomingGames).toBe(0); // cancelled doesn't count

    const atA = await request(app).get(`/api/games?court=${a}`).expect(200);
    expect(atA.body.games).toHaveLength(2);
    expect(atA.body.games.every((g: { court: { id: string } }) => g.court.id === a)).toBe(true);
    await request(app).get('/api/games?court=nope').expect(400);
  });
});
