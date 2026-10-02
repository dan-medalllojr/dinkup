import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db.ts';
import { configurePush, setPushSender } from '../src/lib/notify.ts';
import webpush from 'web-push';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

const HOUR = 60 * 60 * 1000;
const JSON_HEADER = ['Content-Type', 'application/json'] as const;
let seq = 0;

type Player = { id: string; name: string; agent: request.Agent };

async function player(): Promise<Player> {
  const n = ++seq;
  const name = `Player ${n}`;
  const agent = await registeredAgent({ name, email: `n${n}@example.com` });
  const id = (await agent.get('/api/auth/me')).body.user.id as string;
  return { id, name, agent };
}

async function court() {
  return prisma.court.create({ data: { slug: `nc${++seq}`, name: 'DH Sports Hub', address: '', city: 'Cebu', lat: 10.3, lng: 123.9, source: 'test' } });
}

/** An upcoming doubles game hosted by `host`. */
async function upcoming(host: Player) {
  const c = await court();
  const res = await host.agent
    .post('/api/games')
    .send({ courtId: c.id, startsAt: new Date(Date.now() + 24 * HOUR).toISOString(), durationMin: 90, format: 'doubles', minSkillLevel: null })
    .expect(201);
  return res.body.game.id as string;
}

/** A singles game that ended an hour ago; both joined the day before. */
async function finished(a: Player, b: Player) {
  const startsAt = new Date(Date.now() - 2.5 * HOUR);
  const game = await prisma.game.create({
    data: {
      hostId: a.id, courtId: (await court()).id, startsAt, durationMin: 90, format: 'singles', capacity: 2,
      players: { create: [a, b].map((p) => ({ userId: p.id, joinedAt: new Date(startsAt.getTime() - 24 * HOUR) })) },
    },
  });
  return game.id;
}

const inbox = async (p: Player) => (await p.agent.get('/api/notifications').expect(200)).body as { notifications: { text: string; gameId: string; read: boolean }[]; unread: number };
const texts = async (p: Player) => (await inbox(p)).notifications.map((n) => n.text);

afterEach(() => setPushSender(null));

describe('who gets notified', () => {
  it('tells the host when someone joins or leaves, never the player who did it', async () => {
    const [host, p] = [await player(), await player()];
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    await p.agent.post(`/api/games/${gameId}/leave`).set(...JSON_HEADER).expect(200);

    const h = await inbox(host);
    expect(h.unread).toBe(2);
    expect(h.notifications.map((n) => n.text)).toEqual([
      expect.stringMatching(new RegExp(`^${p.name} left your game at DH Sports Hub on .+\\. A spot is open again\\.$`)),
      expect.stringMatching(new RegExp(`^${p.name} joined your game at DH Sports Hub on .+\\. 2 spots left\\.$`)),
    ]);
    expect(h.notifications[0]!.gameId).toBe(gameId);
    expect(await texts(p)).toEqual([]);
  });

  it('tells the players (not the host) when a game is cancelled', async () => {
    const [host, p] = [await player(), await player()];
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    await host.agent.post(`/api/games/${gameId}/cancel`).set(...JSON_HEADER).expect(200);
    expect(await texts(p)).toEqual([expect.stringMatching(new RegExp(`^${host.name} cancelled the game at DH Sports Hub`))]);
    expect((await texts(host)).some((t) => t.includes('cancelled'))).toBe(false);
  });

  it('tells the other players about a comment', async () => {
    const [host, p, q] = [await player(), await player(), await player()];
    const gameId = await upcoming(host);
    for (const x of [p, q]) await x.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    await p.agent.post(`/api/games/${gameId}/comments`).send({ body: 'Running 10 min late' }).expect(201);
    const expected = `${p.name} on the game at DH Sports Hub: “Running 10 min late”`;
    expect((await texts(host))[0]).toBe(expected);
    expect(await texts(q)).toEqual([expected]);
    expect(await texts(p)).toEqual([]);
  });

  it('follows a result: reported → losers, disputed → winners, corrected → new losers, confirmed → winners', async () => {
    const [a, b] = [await player(), await player()];
    const gameId = await finished(a, b);
    const r = await a.agent.post(`/api/games/${gameId}/result`).send({ winnerIds: [a.id], loserIds: [b.id], score: [[11, 7], [11, 9]] }).expect(201);
    expect(await texts(b)).toEqual([expect.stringMatching(new RegExp(`^${a.name} reported a win over you at DH Sports Hub \\(11-7, 11-9\\)\\. Confirm or dispute it by `))]);

    await b.agent.post(`/api/results/${r.body.result.id}/dispute`).set(...JSON_HEADER).expect(200);
    expect((await texts(a))[0]).toMatch(new RegExp(`^${b.name} disputed your win at DH Sports Hub\\. Either side can report a correction by `));

    await b.agent.post(`/api/results/${r.body.result.id}/correct`).send({ winnerIds: [b.id], loserIds: [a.id], score: [[11, 5], [11, 8]] }).expect(200);
    expect((await texts(a))[0]).toMatch(new RegExp(`^${b.name} reported a correction for the game at DH Sports Hub: ${b.name} beat ${a.name}, 11-5, 11-8\\.`));

    await a.agent.post(`/api/results/${r.body.result.id}/confirm`).set(...JSON_HEADER).expect(200);
    expect((await texts(b))[0]).toBe(`${a.name} confirmed your win at DH Sports Hub (11-5, 11-8). See your points on the game page.`);
  });

  it('skips demo players entirely', async () => {
    const [host, p] = [await player(), await player()];
    await prisma.user.update({ where: { id: host.id }, data: { isDemo: true } });
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('the inbox', () => {
  it('is private, newest first, and opening it marks everything read', async () => {
    const [host, p, q] = [await player(), await player(), await player()];
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    await q.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);

    const before = await inbox(host);
    expect(before.unread).toBe(2);
    expect(before.notifications[0]!.text).toContain(q.name);
    await host.agent.post('/api/notifications/read').set(...JSON_HEADER).expect(200);
    const after = await inbox(host);
    expect(after.unread).toBe(0);
    expect(after.notifications.every((n) => n.read)).toBe(true);

    expect((await inbox(p)).notifications).toEqual([]);
    await request(app).get('/api/notifications').expect(401);
  });
});

describe('push keys', () => {
  it('turns push off instead of crashing on bad keys', () => {
    const good = webpush.generateVAPIDKeys();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(configurePush(good.privateKey, good.publicKey, 'https://dinkup.onrender.com')).toBe(false); // swapped
    expect(configurePush('not-a-key', good.privateKey, 'https://dinkup.onrender.com')).toBe(false);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('Push is OFF'));
    errors.mockRestore();
    expect(configurePush(undefined, undefined, 'https://dinkup.onrender.com')).toBe(false);
    expect(configurePush(good.publicKey, good.privateKey, 'https://dinkup.onrender.com')).toBe(true);
  });
});

describe('phone push', () => {
  const sub = (n: number) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: 'BKey', auth: 'auth' } });

  it('reports no public key when push is not configured', async () => {
    expect((await request(app).get('/api/push/key').expect(200)).body).toEqual({ publicKey: null });
  });

  it("pushes to the recipient's subscribed devices, with the game link", async () => {
    const sent = vi.fn().mockResolvedValue(undefined);
    setPushSender(sent);
    const [host, p] = [await player(), await player()];
    await host.agent.post('/api/push/subscribe').send(sub(1)).expect(201);
    await p.agent.post('/api/push/subscribe').send(sub(2)).expect(201);
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);

    await vi.waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    const [to, payload] = sent.mock.calls[0]!;
    expect(to.endpoint).toBe(sub(1).endpoint); // the host's device, not the joiner's
    expect(JSON.parse(payload)).toMatchObject({ title: 'Dinkup', url: `/games/${gameId}`, body: expect.stringContaining(`${p.name} joined your game`) });
  });

  it('forgets a device the push service says is gone (410)', async () => {
    setPushSender(vi.fn().mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 })));
    const [host, p] = [await player(), await player()];
    await host.agent.post('/api/push/subscribe').send(sub(3)).expect(201);
    const gameId = await upcoming(host);
    await p.agent.post(`/api/games/${gameId}/join`).set(...JSON_HEADER).expect(200);
    await vi.waitFor(async () => expect(await prisma.pushSubscription.count()).toBe(0));
  });

  it('moves a device to whoever subscribes on it last, and lets them unsubscribe', async () => {
    const [p, q] = [await player(), await player()];
    await p.agent.post('/api/push/subscribe').send(sub(4)).expect(201);
    await q.agent.post('/api/push/subscribe').send(sub(4)).expect(201);
    const rows = await prisma.pushSubscription.findMany();
    expect(rows.map((r) => r.userId)).toEqual([q.id]);

    await p.agent.post('/api/push/unsubscribe').send({ endpoint: sub(4).endpoint }).expect(200); // not p's anymore
    expect(await prisma.pushSubscription.count()).toBe(1);
    await q.agent.post('/api/push/unsubscribe').send({ endpoint: sub(4).endpoint }).expect(200);
    expect(await prisma.pushSubscription.count()).toBe(0);

    await request(app).post('/api/push/subscribe').send(sub(5)).expect(401);
    await p.agent.post('/api/push/subscribe').send({ endpoint: 'not a url', keys: {} }).expect(400);
  });
});
