import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

/** 'dark' or 'light', following the device setting live. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => (window.matchMedia(QUERY).matches ? 'dark' : 'light'),
  );
}
