import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.ts';
import { env } from './env.ts';

export const SESSION_COOKIE = 'dinkup.sid';

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  // HTTPS-only in production. Requires `trust proxy` behind the host's load balancer.
  secure: env.NODE_ENV === 'production',
} as const;

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  // The `session` table is created by Prisma migrations, not by the store.
  store: new PgStore({ pool, tableName: 'session' }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { ...sessionCookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 },
});
