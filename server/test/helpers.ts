import request from 'supertest';
import { afterAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.ts';
import { pool, prisma } from '../src/db.ts';

export const app = createApp();

export function useCleanDatabase() {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users, session, courts CASCADE');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
}

export const validUser = {
  name: 'Ana Reyes',
  email: 'ana@example.com',
  password: 'correct-horse-battery',
  skillLevel: '3.5',
  preferredFormat: 'doubles',
};

// An agent keeps cookies between requests, like a browser.
export async function registeredAgent(overrides: Partial<typeof validUser> = {}) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ ...validUser, ...overrides }).expect(201);
  return agent;
}
