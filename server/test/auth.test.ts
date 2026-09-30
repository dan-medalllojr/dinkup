import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, registeredAgent, useCleanDatabase, validUser } from './helpers.ts';

useCleanDatabase();

describe('register', () => {
  it('creates an account, logs in, and never returns the password hash', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(validUser).expect(201);

    expect(res.body.user).toMatchObject({
      name: 'Ana Reyes',
      email: 'ana@example.com',
      skillLevel: '3.5',
      preferredFormat: 'doubles',
      skillPoints: 0,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(res.headers['set-cookie']?.[0]).toMatch(/dinkup\.sid=.*HttpOnly.*SameSite=Lax/i);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('ana@example.com');
  });

  it('normalises email so case differences are the same account', async () => {
    await registeredAgent();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: '  ANA@Example.com ' })
      .expect(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('rejects invalid input with per-field errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'nope', password: 'short', skillLevel: '9.0' })
      .expect(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['email', 'name', 'password', 'skillLevel']);
  });

  it('defaults skill level and format when omitted', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ben', email: 'ben@example.com', password: 'long-enough-pw' })
      .expect(201);
    expect(res.body.user).toMatchObject({ skillLevel: '3.0', preferredFormat: 'either' });
  });
});

describe('login and logout', () => {
  it('logs in with correct credentials', async () => {
    await registeredAgent();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: validUser.email, password: validUser.password }).expect(200);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe(validUser.email);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await registeredAgent();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever-pw' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('issues a new session id on login (no session fixation)', async () => {
    await registeredAgent();
    const agent = request.agent(app);
    const first = await agent.post('/api/auth/login').send({ email: validUser.email, password: validUser.password });
    const second = await agent.post('/api/auth/login').send({ email: validUser.email, password: validUser.password });
    const sid = (res: typeof first) => res.headers['set-cookie']?.[0]?.split(';')[0];
    expect(sid(first)).toBeDefined();
    expect(sid(second)).not.toBe(sid(first));
  });

  it('logs out and clears the session', async () => {
    const agent = await registeredAgent();
    await agent.post('/api/auth/logout').set('Content-Type', 'application/json').expect(204);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user).toBeNull();
  });

  it('returns user: null for guests instead of an error', async () => {
    const me = await request(app).get('/api/auth/me').expect(200);
    expect(me.body).toEqual({ user: null });
  });
});

describe('request hardening', () => {
  it('rejects non-JSON bodies on mutating routes', async () => {
    await request(app)
      .post('/api/auth/login')
      .type('form')
      .send({ email: validUser.email, password: validUser.password })
      .expect(415);
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
