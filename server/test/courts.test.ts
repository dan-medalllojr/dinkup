import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { app, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const court = (slug: string, name: string) => ({
  slug,
  name,
  address: 'Somewhere',
  city: 'Cebu City',
  lat: 10.3,
  lng: 123.9,
  source: 'test',
});

describe('GET /api/courts', () => {
  it('is public and returns courts sorted by name, without internal fields', async () => {
    await prisma.court.createMany({ data: [court('zeta', 'Zeta Courts'), court('alpha', 'Alpha Courts')] });

    const res = await request(app).get('/api/courts').expect(200);
    expect(res.body.courts.map((c: { name: string }) => c.name)).toEqual(['Alpha Courts', 'Zeta Courts']);
    expect(res.body.courts[0]).not.toHaveProperty('slug');
    expect(res.body.courts[0]).not.toHaveProperty('source');
  });
});

describe('GET /api/courts/:id', () => {
  it('returns one court', async () => {
    const created = await prisma.court.create({ data: court('alpha', 'Alpha Courts') });
    const res = await request(app).get(`/api/courts/${created.id}`).expect(200);
    expect(res.body.court).toMatchObject({ name: 'Alpha Courts', lat: 10.3, lng: 123.9 });
  });

  it('404s for unknown or malformed ids', async () => {
    await request(app).get('/api/courts/00000000-0000-4000-8000-000000000000').expect(404);
    await request(app).get('/api/courts/nope').expect(404);
  });
});
