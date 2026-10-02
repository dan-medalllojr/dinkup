import { ipKeyGenerator } from 'express-rate-limit';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { feedbackLimiter } from '../src/routes/feedback.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();
// Every test request comes from the same address; start each test fresh.
// (The limiter keys IPv6 addresses by subnet, so build the key the same way.)
beforeEach(() => feedbackLimiter.resetKey(ipKeyGenerator('::ffff:127.0.0.1')));

const send = (body: object, agent: request.Agent | ReturnType<typeof request> = request(app)) =>
  ('post' in agent ? agent : request(app)).post('/api/feedback').set('User-Agent', 'TestPhone/1.0').send(body);

describe('POST /api/feedback', () => {
  it('saves feedback from a guest, with an optional contact', async () => {
    await send({ kind: 'idea', message: 'A leaderboard per court would be fun', contact: ' me@example.com ' }).expect(201);
    const [row] = await prisma.feedback.findMany();
    expect(row).toMatchObject({ kind: 'idea', message: 'A leaderboard per court would be fun', contact: 'me@example.com', userId: null, userAgent: 'TestPhone/1.0' });
  });

  it('links the player and the court when there is one', async () => {
    const agent = await registeredAgent({ email: 'fb@example.com' });
    const me = (await agent.get('/api/auth/me')).body.user.id;
    const court = await prisma.court.create({ data: { slug: 'fb', name: 'Court', address: '', city: 'Cebu', lat: 10.3, lng: 123.9, source: 'test' } });
    await agent.post('/api/feedback').send({ kind: 'court', message: 'The pin is one street too far north', courtId: court.id }).expect(201);
    // An unknown court id is dropped, not an error.
    await agent.post('/api/feedback').send({ kind: 'court', message: 'Another pin issue here', courtId: '00000000-0000-4000-8000-000000000000' }).expect(201);
    const rows = await prisma.feedback.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.userId, r.courtId])).toEqual([[me, court.id], [me, null]]);
  });

  it('validates the message and kind', async () => {
    await send({ kind: 'idea', message: 'hi' }).expect(400);
    await send({ kind: 'complaint', message: 'Not a real kind of feedback' }).expect(400);
    await send({ kind: 'bug', message: 'x'.repeat(1001) }).expect(400);
    expect(await prisma.feedback.count()).toBe(0);
  });

  it('quietly drops bot submissions that fill the hidden field', async () => {
    await send({ kind: 'other', message: 'Buy cheap paddles now!!!', website: 'http://spam.example' }).expect(201);
    expect(await prisma.feedback.count()).toBe(0);
  });

  it('allows 5 an hour per address', async () => {
    for (let i = 0; i < 5; i++) await send({ kind: 'idea', message: `Idea number ${i}` }).expect(201);
    const res = await send({ kind: 'idea', message: 'One idea too many' }).expect(429);
    expect(res.body.error).toMatch(/try again later/);
    expect(await prisma.feedback.count()).toBe(5);
  });
});
