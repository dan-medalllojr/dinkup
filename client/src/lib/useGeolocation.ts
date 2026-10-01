import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '@dinkup/shared';

type State = {
  location: LatLng | null;
  error: string;
  locating: boolean;
  /** Still finding out whether we may use location without asking. */
  checking: boolean;
};

// One location for the whole app, so finding it on Home also sorts Courts and
// Games without asking again.
let shared: LatLng | null = null;
const listeners = new Set<(l: LatLng) => void>();

function publish(location: LatLng) {
  shared = location;
  listeners.forEach((l) => l(location));
}

/** True only if the player already allowed location; never shows a prompt. */
async function alreadyAllowed() {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted';
  } catch {
    return false; // older browsers without the Permissions API
  }
}

// The browser's location prompt only ever appears when the player taps a
// button (locate). A prompt on page load is usually denied, and on an iPhone
// home-screen app it's hard to turn back on. If they already allowed it, we
// use it right away with no prompt.
export function useGeolocation() {
  const [state, setState] = useState<State>({ location: shared, error: '', locating: false, checking: !shared });

  const locate = useCallback((quiet = false) => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, checking: false, error: quiet ? '' : "Your browser can't share your location." }));
      return;
    }
    setState((s) => ({ ...s, locating: !quiet, error: '' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((s) => ({ ...s, locating: false, checking: false }));
        publish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) =>
        setState((s) => ({
          ...s,
          locating: false,
          checking: false,
          error: quiet ? '' : err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : "Couldn't get your location.",
        })),
      // Quiet (automatic) lookups give up sooner, so Home isn't left waiting.
      { enableHighAccuracy: false, timeout: quiet ? 3_000 : 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  useEffect(() => {
    const onLocation = (location: LatLng) => setState((s) => ({ ...s, location }));
    listeners.add(onLocation);
    if (!shared) void alreadyAllowed().then((ok) => (ok ? locate(true) : setState((s) => ({ ...s, checking: false }))));
    return () => void listeners.delete(onLocation);
  }, [locate]);

  return { ...state, locate: useCallback(() => locate(false), [locate]) };
}
