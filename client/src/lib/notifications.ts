import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { NotificationItem } from '@dinkup/shared';
import { api } from './api.ts';
import { useAuth } from './auth.tsx';

// The inbox, shared by the header bell and the notifications page. Refreshed
// when the app opens or comes back to the foreground, and every minute while
// it's visible. (Phone push covers the moments the app is closed.)
type Inbox = { notifications: NotificationItem[]; unread: number; loaded: boolean };
let inbox: Inbox = { notifications: [], unread: 0, loaded: false };
const listeners = new Set<() => void>();
const set = (next: Inbox) => {
  inbox = next;
  listeners.forEach((l) => l());
};

let inFlight: Promise<void> | null = null;
export function refreshInbox() {
  inFlight ??= api<{ notifications: NotificationItem[]; unread: number }>('GET', '/notifications')
    .then((res) => set({ ...res, loaded: true }))
    .catch(() => {}) // offline or logged out: keep what we have
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function markAllRead() {
  if (inbox.unread === 0) return;
  set({ ...inbox, unread: 0 });
  await api('POST', '/notifications/read').catch(() => {});
}

const POLL_MS = 60_000;

export function useInbox() {
  const { user } = useAuth();
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => inbox,
  );

  useEffect(() => {
    if (!user) {
      set({ notifications: [], unread: 0, loaded: false });
      return;
    }
    void refreshInbox();
    const onVisible = () => document.visibilityState === 'visible' && void refreshInbox();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [user]);

  return { ...state, refresh: useCallback(() => refreshInbox(), []) };
}
