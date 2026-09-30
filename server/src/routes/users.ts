import { Router } from 'express';
import { z } from 'zod';
import { updateProfileSchema } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { HttpError } from '../lib/http-error.ts';
import { toDbLevel, toMe, toPublicUser } from '../lib/users.ts';
import { requireAuth } from '../middleware/auth.ts';

export const usersRouter = Router();

usersRouter.patch('/me', requireAuth, async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
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
