import { readStorage, writeStorage } from './storage.ts';

// An installed app keeps running the version it cached until the player taps
// "Reload" on the update toast or closes every window. Meanwhile a deploy
// removes that version's lazily loaded files (like the map), so opening
// Courts fails with "Failed to fetch dynamically imported module". A plain
// reload doesn't help: the old service worker serves the old version again.

/** True for the "a lazy chunk didn't load" errors of Chrome, Safari, and Firefox. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i.test(message);
}

const LAST_TRY_KEY = 'dinkup.staleReloadAt';
const RETRY_GAP_MS = 30_000;

/** Whether we already tried recently (so a broken new version can't reload forever). */
export function triedRecently() {
  const at = Number(readStorage(LAST_TRY_KEY));
  return Number.isFinite(at) && Date.now() - at < RETRY_GAP_MS;
}

/**
 * Switch to the newest version and reload. If a new service worker is
 * installed (or installing), activate it first; otherwise just reload.
 */
export async function reloadWithLatest() {
  writeStorage(LAST_TRY_KEY, String(Date.now()));
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (!reg) return window.location.reload();

  await reg.update().catch(() => {});
  const next = reg.waiting ?? reg.installing;
  if (!next) return window.location.reload();

  // Reload once the new worker takes over, or after 10 s whatever happens.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  setTimeout(() => window.location.reload(), 10_000);
  const activate = (sw: ServiceWorker) => sw.postMessage({ type: 'SKIP_WAITING' });
  if (next.state === 'installed') activate(next);
  else next.addEventListener('statechange', () => next.state === 'installed' && activate(next));
}
