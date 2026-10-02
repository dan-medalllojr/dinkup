import { z } from 'zod';

export type NotificationItem = {
  id: string;
  text: string;
  /** Opens this game when tapped; null if the game is gone. */
  gameId: string | null;
  createdAt: string;
  read: boolean;
};

// A browser's PushSubscription.toJSON(), as sent to /api/push/subscribe.
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
