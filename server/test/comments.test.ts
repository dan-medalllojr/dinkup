import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.ts';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const JSON_HEADER = ['Content-Type', 'application/json'] as const;
let seq = 0;

async function player() {
  const n = ++seq;
  return registeredAgent({ name: `Player ${n}`, email: `player${n}@example.com` });
}

async function setup() {
  const court = await prisma.court.create({
    data: { slug: `court-${++seq}`, name: 'Court', address: '', city: 'Cebu City', lat: 10.3, lng: 123.9, source: 'test' },
  });
  const host = await player();
  const joiner = await player();
  const outsider = await player();
  const res = await host
    .post('/api/games')
    .send({ courtId: court.id, startsAt: new Date(Date.now() + 24 * 3600_000).toISOString(), durationMin: 90, format: 'doubles', minSkillLevel: null })
    .expect(201);
  const gameId: string = res.body.game.id;
  await joiner.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
  return { host, joiner, outsider, gameId, url: `/api/games/${gameId}/comments` };
}

describe('game comments', () => {
  it('lets players post and anyone read, oldest first, without emails', async () => {
    const { host, joiner, url } = await setup();
    await joiner.post(url).send({ body: '  Running 10 min late  ' }).expect(201);
    await host.post(url).send({ body: 'No worries, court 2' }).expect(201);

    const res = await request(app).get(url).expect(200);
    expect(res.body.comments.map((c: { body: string }) => c.body)).toEqual(['Running 10 min late', 'No worries, court 2']);
    expect(res.body.comments[0].author.name).toMatch(/Player/);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });

  it('requires login to post and blocks non-players', async () => {
    const { outsider, url } = await setup();
    await request(app).post(url).send({ body: 'hi' }).expect(401);
    const res = await outsider.post(url).send({ body: 'Can I join?' }).expect(403);
    expect(res.body.error).toMatch(/Only players/);
  });

  it('stops a player who left from posting, but keeps their old comments', async () => {
    const { joiner, gameId, url } = await setup();
    await joiner.post(url).send({ body: 'See you there' }).expect(201);
    await joiner.post(`/api/games/${gameId}/leave`).set(...JSON_HEADER).expect(200);
    await joiner.post(url).send({ body: 'Actually…' }).expect(403);
    const res = await request(app).get(url).expect(200);
    expect(res.body.comments).toHaveLength(1);
  });

  it('rejects blank and overlong comments', async () => {
    const { joiner, url } = await setup();
    await joiner.post(url).send({ body: '    ' }).expect(400);
    await joiner.post(url).send({ body: 'x'.repeat(501) }).expect(400);
    await joiner.post(url).send({}).expect(400);
    await joiner.post(url).send({ body: 'x'.repeat(500) }).expect(201);
  });

  it('stores markup as plain text (React escapes it on render)', async () => {
    const { joiner, url } = await setup();
    const body = '<img src=x onerror=alert(1)>';
    const res = await joiner.post(url).send({ body }).expect(201);
    expect(res.body.comment.body).toBe(body);
  });

  it('404s for unknown games', async () => {
    const p = await player();
    await request(app).get('/api/games/00000000-0000-4000-8000-000000000000/comments').expect(404);
    await p.post('/api/games/00000000-0000-4000-8000-000000000000/comments').send({ body: 'hi' }).expect(404);
    await request(app).get('/api/games/nope/comments').expect(404);
  });

  it('rate limits each user to 10 comments a minute', async () => {
    const { joiner, host, url } = await setup();
    for (let i = 0; i < 10; i++) await joiner.post(url).send({ body: `msg ${i}` }).expect(201);
    const res = await joiner.post(url).send({ body: 'one more' }).expect(429);
    expect(res.body.error).toMatch(/too fast/);
    // Per user: the host isn't affected by the joiner's burst.
    await host.post(url).send({ body: 'calm down' }).expect(201);
  });
});

describe('deleting comments', () => {
  it('lets the author delete their own comment', async () => {
    const { joiner, url } = await setup();
    const c = await joiner.post(url).send({ body: 'oops' }).expect(201);
    await joiner.delete(`${url}/${c.body.comment.id}`).set(...JSON_HEADER).expect(204);
    expect((await request(app).get(url)).body.comments).toHaveLength(0);
  });

  it("lets the host delete anyone's comment on their game", async () => {
    const { host, joiner, url } = await setup();
    const c = await joiner.post(url).send({ body: 'spam' }).expect(201);
    await host.delete(`${url}/${c.body.comment.id}`).set(...JSON_HEADER).expect(204);
  });

  it("doesn't let other players delete someone else's comment", async () => {
    const { host, joiner, url } = await setup();
    const c = await host.post(url).send({ body: 'Court 2' }).expect(201);
    const res = await joiner.delete(`${url}/${c.body.comment.id}`).set(...JSON_HEADER).expect(403);
    expect(res.body.error).toMatch(/your own/);
  });

  it('404s when the comment belongs to a different game', async () => {
    const a = await setup();
    const b = await setup();
    const c = await a.joiner.post(a.url).send({ body: 'hi' }).expect(201);
    // b's host tries to delete a's comment through b's game URL.
    await b.host.delete(`${b.url}/${c.body.comment.id}`).set(...JSON_HEADER).expect(404);
  });
});

describe('database constraint', () => {
  it('rejects a blank body even bypassing the API', async () => {
    const { gameId } = await setup();
    const user = await prisma.user.findFirstOrThrow();
    await expect(prisma.gameComment.create({ data: { gameId, userId: user.id, body: '   ' } })).rejects.toThrow(
      /game_comments_body_not_blank/,
    );
  });
});
