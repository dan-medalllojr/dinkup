import { useEffect, useState } from 'react';

/**
 * A counter that goes up each time the browser comes back online. Add it to a
 * data-loading effect's dependencies so an offline error clears itself on
 * reconnect, which is what the offline banner promises.
 */
export function useReconnect() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onOnline = () => setCount((n) => n + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  return count;
}
