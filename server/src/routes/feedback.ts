import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { feedbackSchema } from '@dinkup/shared';
import { prisma } from '../db.ts';

export const feedbackRouter = Router();

// Guests can send feedback too, so cap it per address.
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: "That's a lot of feedback in one hour. Thanks! Please try again later." },
});

// Saved to the database only (for now there's no inbox or email for it).
feedbackRouter.post('/', feedbackLimiter, async (req, res) => {
  const input = feedbackSchema.parse(req.body);
  // A filled-in hidden field means a bot: answer as if it worked, save nothing.
  if (input.website) {
    res.status(201).json({ ok: true });
    return;
  }
  const court = input.courtId ? await prisma.court.findUnique({ where: { id: input.courtId }, select: { id: true } }) : null;
  await prisma.feedback.create({
    data: {
      kind: input.kind,
      message: input.message,
      contact: input.contact,
      courtId: court?.id,
      userId: req.session.userId,
      userAgent: req.get('user-agent')?.slice(0, 300),
    },
  });
  res.status(201).json({ ok: true });
});
