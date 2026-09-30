import { useCallback, useState } from 'react';
import type { LatLng } from '@dinkup/shared';

type State = { location: LatLng | null; error: string; locating: boolean };

// Asks for location only when the user taps the button, never on page load.
export function useGeolocation() {
  const [state, setState] = useState<State>({ location: null, error: '', locating: false });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: "Your browser can't share your location." }));
      return;
    }
    setState((s) => ({ ...s, locating: true, error: '' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude }, error: '', locating: false }),
      (err) =>
        setState((s) => ({
          ...s,
          locating: false,
          error: err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : "Couldn't get your location.",
        })),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { ...state, locate };
}
