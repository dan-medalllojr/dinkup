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

// iPhone/iPad Safari has no install API; users add it from the Share menu.
export function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
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
