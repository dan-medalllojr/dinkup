import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createCommentSchema, type GameComment } from '@dinkup/shared';
import { prisma } from '../db.ts';
import type { GameComment as DbComment, User } from '../generated/prisma/client.ts';
import { HttpError } from '../lib/http-error.ts';
import { fromDbLevel } from '../lib/users.ts';
import { requireAuth } from '../middleware/auth.ts';

// Mounted at /api/games/:id/comments.
export const commentsRouter = Router({ mergeParams: true });

const MAX_COMMENTS_RETURNED = 200;

// Per user, not per IP: players on the same court Wi-Fi share an IP.
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.session.userId!,
  message: { error: "You're commenting too fast. Wait a minute and try again." },
});

function toComment(c: DbComment & { user: User }): GameComment {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: { id: c.user.id, name: c.user.name, photoUrl: c.user.photoUrl, skillLevel: fromDbLevel(c.user.skillLevel), isDemo: c.user.isDemo },
  };
}

function gameIdParam(params: Record<string, unknown>) {
  const id = z.uuid().safeParse(params.id);
  if (!id.success) throw new HttpError(404, 'Game not found');
  return id.data;
}

// Public, like the game page itself. Oldest first so it reads like a chat.
commentsRouter.get('/', async (req, res) => {
  const gameId = gameIdParam(req.params);
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) throw new HttpError(404, 'Game not found');

  // Take the newest N, then show them oldest first.
  const rows = await prisma.gameComment.findMany({
    where: { gameId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_COMMENTS_RETURNED,
  });
  res.json({ comments: rows.reverse().map(toComment) });
});

// Only the game's players (host included) can post, so strangers can't spam
// games they aren't part of. Someone who left can no longer post.
commentsRouter.post('/', requireAuth, commentLimiter, async (req, res) => {
  const gameId = gameIdParam(req.params);
  const { body } = createCommentSchema.parse(req.body);
  const userId = req.session.userId!;

  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: { where: { userId } } } });
  if (!game) throw new HttpError(404, 'Game not found');
  if (game.players.length === 0) throw new HttpError(403, 'Only players in this game can comment');

  const comment = await prisma.gameComment.create({ data: { gameId, userId, body }, include: { user: true } });
  res.status(201).json({ comment: toComment(comment) });
});

// The author can delete their own comment; the host can moderate their game.
commentsRouter.delete('/:commentId', requireAuth, async (req, res) => {
  const gameId = gameIdParam(req.params);
  const commentId = z.uuid().safeParse(req.params.commentId);
  const comment = commentId.success
    ? await prisma.gameComment.findUnique({ where: { id: commentId.data }, include: { game: { select: { hostId: true } } } })
    : null;
  // Also 404 if the comment belongs to a different game than the URL says.
  if (!comment || comment.gameId !== gameId) throw new HttpError(404, 'Comment not found');

  const userId = req.session.userId;
  if (comment.userId !== userId && comment.game.hostId !== userId) {
    throw new HttpError(403, 'You can only delete your own comments');
  }

  await prisma.gameComment.delete({ where: { id: comment.id } });
  res.status(204).end();
});
