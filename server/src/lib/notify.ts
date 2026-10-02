import webpush from 'web-push';
import { TIMEZONE } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { env } from '../env.ts';
import type { NotificationType } from '../generated/prisma/client.ts';

// Notifications: one inbox row per person, plus a Web Push to each of their
// subscribed phones/browsers. Called after the action has succeeded, and never
// allowed to break it: a failed notification is logged, not thrown.

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

export type PushPayload = { title: string; body: string; url: string; tag: string };
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
type Sender = (sub: Subscription, payload: string) => Promise<unknown>;

// Swappable so tests can see what would be pushed without a push service.
let sender: Sender | null = pushEnabled ? (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 24 * 60 * 60 }) : null;
export function setPushSender(fn: Sender | null) {
  sender = fn;
}

const WHEN = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
/** "Fri, Oct 2, 6:30 PM": used in notification text. */
export const when = (d: Date) => WHEN.format(d);

type Event = {
  type: NotificationType;
  text: string;
  gameId: string;
  /** Who did it: never notified about their own action. */
  actorId: string;
};

const clip = (text: string) => (text.length > 300 ? `${text.slice(0, 299)}…` : text);

export async function notify(recipientIds: string[], event: Event): Promise<void> {
  try {
    const ids = [...new Set(recipientIds)].filter((id) => id !== event.actorId);
    if (ids.length === 0) return;
    // Demo players (the fake cast and "Try the demo" visitors) get nothing.
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isDemo: false }, select: { id: true } });
    if (users.length === 0) return;
    const userIds = users.map((u) => u.id);
    await prisma.notification.createMany({
      // Names and court names can be long; the column holds 300.
      data: userIds.map((userId) => ({ userId, type: event.type, text: clip(event.text), gameId: event.gameId })),
    });
    if (sender) void push(userIds, { title: 'Dinkup', body: clip(event.text), url: `/games/${event.gameId}`, tag: `${event.type}:${event.gameId}` });
  } catch (err) {
    console.error('Notification failed', err);
  }
}

async function push(userIds: string[], payload: PushPayload) {
  const send = sender;
  if (!send) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (err) {
        // 404/410: the browser unsubscribed or the app was removed. Forget it.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
        else console.error('Push failed', status ?? err);
      }
    }),
  ).catch((err) => console.error('Push failed', err));
}
