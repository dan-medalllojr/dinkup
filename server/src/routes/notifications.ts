import { Router } from 'express';
import { pushSubscriptionSchema, type NotificationItem } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import { pushEnabled } from '../lib/notify.ts';
import { requireAuth } from '../middleware/auth.ts';

export const notificationsRouter = Router();

const INBOX_SIZE = 30;
// Read notifications older than this are deleted the next time the inbox is opened.
const KEEP_READ_DAYS = 30;

// My inbox: the newest 30, and how many are unread (for the bell's badge).
notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  await prisma.notification.deleteMany({
    where: { userId, readAt: { lt: new Date(Date.now() - KEEP_READ_DAYS * 24 * 60 * 60 * 1000) } },
  });
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: INBOX_SIZE }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const notifications: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    text: n.text,
    gameId: n.gameId,
    createdAt: n.createdAt.toISOString(),
    read: n.readAt !== null,
  }));
  res.json({ notifications, unread });
});

// Opening the inbox marks everything read.
notificationsRouter.post('/notifications/read', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.session.userId!, readAt: null }, data: { readAt: new Date() } });
  res.json({ unread: 0 });
});

// The public key browsers need to subscribe; null when push isn't set up.
notificationsRouter.get('/push/key', (_req, res) => {
  res.json({ publicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null });
});

// Save this browser's subscription for the logged-in player. The endpoint is
// unique per browser install, so subscribing again (or as another account on
// the same phone) moves it rather than duplicating it.
notificationsRouter.post('/push/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = pushSubscriptionSchema.parse(req.body);
  const userId = req.session.userId!;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId },
  });
  res.status(201).json({ ok: true });
});

notificationsRouter.post('/push/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = pushSubscriptionSchema.pick({ endpoint: true }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.session.userId! } });
  res.json({ ok: true });
});
