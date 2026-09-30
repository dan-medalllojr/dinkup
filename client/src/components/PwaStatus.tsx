import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Registers the service worker and shows two things: an "update ready" toast
// (we never swap versions under someone mid-form), and an offline banner.
export function PwaStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version hourly for installed apps that stay open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return (
    <>
      {!online ? (
        <div className="offline-banner" role="status">
          You're offline. Games and comments will update when you reconnect.
        </div>
      ) : null}
      {needRefresh ? (
        <div className="toast" role="status">
          <span>A new version of Dinkup is ready.</span>
          <button className="button button-small" onClick={() => void updateServiceWorker(true)}>
            Reload
          </button>
          <button className="link-button small" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      ) : null}
    </>
  );
}
