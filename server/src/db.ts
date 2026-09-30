import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';
import { env } from './env.ts';

// Neon URLs carry `sslmode=require`, which pg now warns about on every start
// (it's treated as verify-full, and that meaning changes in pg v9). Take SSL
// settings out of the URL and set them explicitly instead: full certificate
// verification, plus channel binding when the URL asks for it.
function poolConfig(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get('sslmode');
  if (!sslmode || sslmode === 'disable') return { connectionString: url };

  const channelBinding = parsed.searchParams.get('channel_binding') === 'require';
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('channel_binding');
  return {
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: channelBinding,
  };
}

// One pool shared by Prisma and the session store.
export const pool = new pg.Pool(poolConfig(env.DATABASE_URL));
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
