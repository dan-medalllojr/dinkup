import { useCallback, useSyncExternalStore } from 'react';
import { NEAR_RADII_KM } from '@dinkup/shared';
import { readStorage, writeStorage } from './storage.ts';

// How far "near me" reaches, in km. Shared by Home and Courts and remembered
// on this device, so changing it on one page changes it on the other.
const KEY = 'dinkup.nearRadiusKm';
const DEFAULT_KM = 10;
const listeners = new Set<() => void>();

function initial(): number {
  const km = Number(readStorage(KEY));
  return (NEAR_RADII_KM as readonly number[]).includes(km) ? km : DEFAULT_KM;
}
let radius = initial();

export function useNearRadius() {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => radius,
  );
  const set = useCallback((km: number) => {
    radius = km;
    writeStorage(KEY, String(km));
    listeners.forEach((l) => l());
  }, []);
  return [value, set] as const;
}
