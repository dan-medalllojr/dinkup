import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';
import { env } from './env.ts';

// One pool shared by Prisma and the session store.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
