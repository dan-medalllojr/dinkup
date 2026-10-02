import { api } from './api.ts';
import { isIos, isStandalone } from './install.ts';

// Phone notifications (Web Push). On iPhone they only work once Dinkup is on
// the home screen (iOS 16.4+), so that case gets its own state.
export type PushState = 'unsupported' | 'install-first' | 'not-configured' | 'denied' | 'off' | 'on';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// getRegistration(), not .ready: .ready never resolves when no service worker
// is registered (dev mode), which would hang logout.
const registration = () => navigator.serviceWorker.getRegistration().catch(() => undefined);

async function serverKey(): Promise<string | null> {
  return (await api<{ publicKey: string | null }>('GET', '/push/key')).publicKey;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'install-first' : 'unsupported';
  if (!(await serverKey().catch(() => null))) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

// The VAPID key arrives base64url-encoded; subscribe() wants bytes.
function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Must run from a tap: browsers only show the permission prompt for one. */
export async function turnOnPush(): Promise<PushState> {
  const key = await serverKey();
  if (!key) return 'not-configured';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api('POST', '/push/subscribe', sub.toJSON());
  return 'on';
}

export async function turnOffPush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) {
    await api('POST', '/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

/** This browser is subscribed: make sure it's linked to whoever is logged in now. */
export async function claimPush() {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) await api('POST', '/push/subscribe', sub.toJSON()).catch(() => {});
}
