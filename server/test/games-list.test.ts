import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDaysToDate, todayInManila } from '@dinkup/shared';
import { prisma } from '../src/db.ts';
import type { GameFormat, SkillLevel } from '../src/generated/prisma/client.ts';
import { app, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const HOUR = 60 * 60 * 1000;
let seq = 0;

async function user(name = `Player ${++seq}`) {
  return prisma.user.create({ data: { name, email: `p${++seq}@example.com`, passwordHash: 'x' } });
}

async function court(name: string, lat: number, lng: number) {
  return prisma.court.create({ data: { slug: `c-${++seq}`, name, address: '', city: 'Cebu', lat, lng, source: 'test' } });
}

type GameOpts = { startsAt: Date; format?: GameFormat; minSkillLevel?: SkillLevel | null; status?: 'open' | 'cancelled'; players?: number };

async function game(courtId: string, { startsAt, format = 'doubles', minSkillLevel = null, status = 'open', players = 1 }: GameOpts) {
  const host = await user();
  const others = await Promise.all(Array.from({ length: players - 1 }, () => user()));
  return prisma.game.create({
    data: {
      hostId: host.id,
      courtId,
      startsAt,
      durationMin: 90,
      format,
      capacity: format === 'singles' ? 2 : 4,
      minSkillLevel,
      status,
      players: { create: [host, ...others].map((u) => ({ userId: u.id })) },
    },
  });
}

const inHours = (h: number) => new Date(Date.now() + h * HOUR);
const ids = (res: request.Response) => res.body.games.map((g: { id: string }) => g.id);

describe('GET /api/games', () => {
  it('is public and lists upcoming open games, soonest first', async () => {
    const c = await court('Alpha', 10.3, 123.9);
    const later = await game(c.id, { startsAt: inHours(48) });
    const sooner = await game(c.id, { startsAt: inHours(3) });
    await game(c.id, { startsAt: inHours(5), status: 'cancelled' });
    await game(c.id, { startsAt: inHours(-0.5) }); // already started

    const res = await request(app).get('/api/games').expect(200);
    expect(ids(res)).toEqual([sooner.id, later.id]);
    expect(res.body.games[0].distanceKm).toBeNull();
  });

  it('keeps full games in the list, marked full', async () => {
    const c = await court('Alpha', 10.3, 123.9);
    await game(c.id, { startsAt: inHours(3), format: 'singles', players: 2 });
    const res = await request(app).get('/api/games').expect(200);
    expect(res.body.games[0].status).toBe('full');
  });

  it('filters by Manila calendar day, including games near midnight', async () => {
    const c = await court('Alpha', 10.3, 123.9);
    const day = addDaysToDate(todayInManila(), 3);
    const next = addDaysToDate(day, 1);
    const earlyMorning = await game(c.id, { startsAt: new Date(`${day}T00:15:00+08:00`) });
    const lateNight = await game(c.id, { startsAt: new Date(`${day}T23:30:00+08:00`) });
    await game(c.id, { startsAt: new Date(`${next}T00:30:00+08:00`) });
    // 23:30 Manila on `day` is 15:30 UTC on `day`; 00:30 on `next` is 16:30 UTC on `day`.
    // A UTC-based day filter would get this wrong.

    const res = await request(app).get(`/api/games?date=${day}`).expect(200);
    expect(ids(res)).toEqual([earlyMorning.id, lateNight.id]);
  });

  it('filters to games a given level can join', async () => {
    const c = await court('Alpha', 10.3, 123.9);
    const any = await game(c.id, { startsAt: inHours(3) });
    const beginner = await game(c.id, { startsAt: inHours(4), minSkillLevel: 'L3_0' });
    await game(c.id, { startsAt: inHours(5), minSkillLevel: 'L4_0' });

    const res = await request(app).get('/api/games?level=3.5').expect(200);
    expect(ids(res)).toEqual([any.id, beginner.id]);
  });

  it('filters by format', async () => {
    const c = await court('Alpha', 10.3, 123.9);
    const singles = await game(c.id, { startsAt: inHours(3), format: 'singles' });
    await game(c.id, { startsAt: inHours(4), format: 'doubles' });
    const res = await request(app).get('/api/games?format=singles').expect(200);
    expect(ids(res)).toEqual([singles.id]);
  });

  it('sorts by distance when given a location', async () => {
    const mandaue = await court('Mandaue', 10.3242, 123.9268);
    const talisay = await court('Talisay', 10.2685, 123.8364);
    const farSoon = await game(talisay.id, { startsAt: inHours(2) });
    const nearLater = await game(mandaue.id, { startsAt: inHours(30) });

    // Standing in Mandaue.
    const res = await request(app).get('/api/games?near=10.33,123.93').expect(200);
    expect(ids(res)).toEqual([nearLater.id, farSoon.id]);
    expect(res.body.games[0].distanceKm).toBeLessThan(1);
    expect(res.body.games[1].distanceKm).toBeGreaterThan(10);
  });

  it('returns the nearest games when limited, not the soonest', async () => {
    const mandaue = await court('Mandaue', 10.3242, 123.9268);
    const talisay = await court('Talisay', 10.2685, 123.8364);
    await game(talisay.id, { startsAt: inHours(2) });
    const near = await game(mandaue.id, { startsAt: inHours(30) });

    const res = await request(app).get('/api/games?near=10.33,123.93&limit=1').expect(200);
    expect(ids(res)).toEqual([near.id]);
  });

  it('keeps only games within the given distance', async () => {
    const mandaue = await court('Mandaue', 10.3242, 123.9268);
    const talisay = await court('Talisay', 10.2685, 123.8364);
    const near = await game(mandaue.id, { startsAt: inHours(30) });
    await game(talisay.id, { startsAt: inHours(2) }); // ~11 km away

    const res = await request(app).get('/api/games?near=10.33,123.93&within=5').expect(200);
    expect(ids(res)).toEqual([near.id]);
    const wide = await request(app).get('/api/games?near=10.33,123.93&within=100').expect(200);
    expect(wide.body.games).toHaveLength(2);
  });

  it('rejects malformed filters', async () => {
    await request(app).get('/api/games?date=2026-13-40').expect(400);
    await request(app).get('/api/games?level=9.0').expect(400);
    await request(app).get('/api/games?near=somewhere').expect(400);
    await request(app).get('/api/games?near=200,500').expect(400);
    await request(app).get('/api/games?limit=0').expect(400);
    await request(app).get('/api/games?within=5').expect(400); // needs near
    await request(app).get('/api/games?near=10.33,123.93&within=500').expect(400);
  });
});
