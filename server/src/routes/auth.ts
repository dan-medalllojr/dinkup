import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { loginSchema, registerSchema } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { createDemoVisitor } from '../lib/demo.ts';
import { HttpError } from '../lib/http-error.ts';
import { toDbLevel, toMe } from '../lib/users.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../session.ts';

const BCRYPT_ROUNDS = 12;

// Compared against when the email doesn't exist, so "no such user" and
// "wrong password" take the same time and can't be told apart.
const DUMMY_HASH = bcrypt.hashSync('dinkup-timing-guard', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
  skip: () => env.NODE_ENV === 'test',
});

// Each click makes a throwaway account, so cap how many one IP can create.
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: "You've started a lot of demos. Try again in an hour, or sign up." },
  skip: () => env.NODE_ENV === 'test',
});

// New session ID on every login/register to prevent session fixation.
function startSession(req: Request, userId: string) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        skillLevel: toDbLevel(input.skillLevel),
        preferredFormat: input.preferredFormat,
      },
    });
  } catch (err) {
    // Unique index on email; relying on it avoids a check-then-insert race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account with that email already exists');
    }
    throw err;
  }

  await startSession(req, user.id);
  res.status(201).json({ user: toMe(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Incorrect email or password');

  await startSession(req, user.id);
  res.json({ user: toMe(user) });
});

// "Try the demo": log straight into a fresh demo account, no signup needed.
// A fresh account per visitor (instead of one shared login) means one
// person's changes never leak into the next person's demo.
authRouter.post('/demo', demoLimiter, async (req, res) => {
  if (!env.DEMO_MODE) throw new HttpError(404, 'Not found');
  const visitor = await createDemoVisitor();
  await startSession(req, visitor.id);
  res.status(201).json({ user: toMe(visitor) });
});

authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    res.status(204).end();
  });
});

// Guests get `{ user: null }` rather than a 401, since browsing is public.
authRouter.get('/me', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    res.json({ user: null });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    // Account was deleted while the session was still alive.
    req.session.destroy(() => res.json({ user: null }));
    return;
  }
  res.json({ user: toMe(user) });
});
