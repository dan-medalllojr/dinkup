import { Router } from 'express';
import { z } from 'zod';
import { updateProfileSchema } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { HttpError } from '../lib/http-error.ts';
import { hasConfirmedResult } from '../lib/results.ts';
import { toDbLevel, toMe, toPublicUser } from '../lib/users.ts';
import { requireAuth } from '../middleware/auth.ts';

export const usersRouter = Router();

usersRouter.patch('/me', requireAuth, async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  // Your starting level is a self-assessment; after your first confirmed
  // result, only results move it (otherwise anyone could skip leveling).
  if (input.skillLevel) {
    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } });
    if (toDbLevel(input.skillLevel) !== current.skillLevel && (await hasConfirmedResult(current.id))) {
      throw new HttpError(403, 'Your level is set by confirmed results now, so it can\'t be changed by hand');
    }
  }
  const user = await prisma.user.update({
    where: { id: req.session.userId },
    data: {
      name: input.name,
      skillLevel: input.skillLevel && toDbLevel(input.skillLevel),
      preferredFormat: input.preferredFormat,
    },
  });
  res.json({ user: toMe(user) });
});

usersRouter.get('/:id', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const user = id.success ? await prisma.user.findUnique({ where: { id: id.data } }) : null;
  if (!user) throw new HttpError(404, 'Player not found');
  res.json({ user: toPublicUser(user) });
});
