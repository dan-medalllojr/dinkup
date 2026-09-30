import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, registeredAgent, useCleanDatabase } from './helpers.ts';

useCleanDatabase();

describe('PATCH /api/users/me', () => {
  it('requires login', async () => {
    await request(app).patch('/api/users/me').send({ skillLevel: '4.0' }).expect(401);
  });

  it('updates name, skill level, and format', async () => {
    const agent = await registeredAgent();
    const res = await agent
      .patch('/api/users/me')
      .send({ name: 'Ana R.', skillLevel: '4.0', preferredFormat: 'singles' })
      .expect(200);
    expect(res.body.user).toMatchObject({ name: 'Ana R.', skillLevel: '4.0', preferredFormat: 'singles' });
  });

  it('rejects fields that are not editable', async () => {
    const agent = await registeredAgent();
    await agent.patch('/api/users/me').send({ skillPoints: 999 }).expect(400);
    await agent.patch('/api/users/me').send({ email: 'hijack@example.com' }).expect(400);
  });
});

describe('GET /api/users/:id', () => {
  it('returns a public profile without the email', async () => {
    const agent = await registeredAgent();
    const me = await agent.get('/api/auth/me');
    const res = await request(app).get(`/api/users/${me.body.user.id}`).expect(200);
    expect(res.body.user.name).toBe('Ana Reyes');
    expect(res.body.user).not.toHaveProperty('email');
  });

  it('404s for unknown or malformed ids', async () => {
    await request(app).get('/api/users/00000000-0000-4000-8000-000000000000').expect(404);
    await request(app).get('/api/users/not-a-uuid').expect(404);
  });
});
