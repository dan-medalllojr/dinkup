import { useSyncExternalStore } from 'react';

// Chrome/Edge/Android fire `beforeinstallprompt` once, early, possibly before
// React renders. Capture it at module load and hand it out through a hook.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export const isAndroid = () => /Android/.test(navigator.userAgent);

// iPhone/iPad Safari has no install API; users add it from the Share menu.
export function isIosSafari() {
  const ua = navigator.userAgent;
  return isIos() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) && !inAppBrowser();
}

// Links shared in chat apps open in the app's own browser, which can't
// install anything. Returns the app's name so we can say "open it in Chrome".
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent;
  if (/Messenger|Orca-Android/.test(ua)) return 'Messenger';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'Facebook';
  if (/Instagram/.test(ua)) return 'Instagram';
  if (/\bLine\//.test(ua)) return 'LINE';
  if (/musical_ly|BytedanceWebview|TikTok/.test(ua)) return 'TikTok';
  return null;
}

type InstallState = { canPrompt: boolean; installed: boolean };
let snapshot: InstallState = { canPrompt: false, installed: false };

export function useInstallPrompt() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      const next = { canPrompt: deferred !== null, installed };
      if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) snapshot = next;
      return snapshot;
    },
  );

  async function promptInstall() {
    if (!deferred) return 'unavailable' as const;
    const event = deferred;
    deferred = null; // the event can only be used once
    emit();
    await event.prompt();
    return (await event.userChoice).outcome;
  }

  return { ...state, promptInstall };
}
