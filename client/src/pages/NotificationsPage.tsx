import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { relativeTime } from '../lib/relativeTime.ts';
import { markAllRead, useInbox } from '../lib/notifications.ts';
import { claimPush, pushState, turnOffPush, turnOnPush, type PushState } from '../lib/push.ts';

export function NotificationsPage() {
  const { notifications, loaded, refresh } = useInbox();
  // Remember which were unread when the page opened, so they stay highlighted
  // this visit even though opening the page marks them read.
  const unreadOnOpen = useRef<Set<string> | null>(null);
  if (unreadOnOpen.current === null && loaded) unreadOnOpen.current = new Set(notifications.filter((n) => !n.read).map((n) => n.id));

  useEffect(() => {
    void refresh().then(markAllRead);
  }, [refresh]);

  return (
    <div className="stack">
      <h1>Notifications</h1>
      <PushCard />
      {!loaded ? (
        <p className="muted">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="card muted">Nothing yet. You'll hear here when someone joins your game, comments, or reports a result.</p>
      ) : (
        <ul className="notification-list">
          {notifications.map((n) => {
            const fresh = unreadOnOpen.current?.has(n.id);
            const body = (
              <>
                <span>{n.text}</span>
                <span className="muted small">{relativeTime(n.createdAt)}</span>
              </>
            );
            return (
              <li key={n.id} className={fresh ? 'is-unread' : undefined}>
                {n.gameId ? (
                  <Link to={`/games/${n.gameId}`} className="card card-link notification">
                    {body}
                  </Link>
                ) : (
                  <div className="card notification">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PUSH_COPY: Record<PushState, string> = {
  unsupported: "This browser can't show phone notifications. You'll still see them here.",
  'install-first': 'On iPhone, add Dinkup to your home screen first, then open it from there to turn on notifications.',
  'not-configured': '',
  denied: 'Notifications are blocked for Dinkup. Allow them in your browser or phone settings to get them here too.',
  off: 'Get a notification on this phone when someone joins your game, comments, or reports a result.',
  on: 'This phone gets Dinkup notifications.',
};

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void pushState().then((s) => {
      setState(s);
      if (s === 'on') void claimPush();
    });
  }, []);

  if (!state || state === 'not-configured') return null;

  async function toggle(on: boolean) {
    setBusy(true);
    setError('');
    try {
      setState(on ? await turnOnPush() : await turnOffPush());
    } catch {
      setError("Couldn't change notifications on this phone. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack-tight push-card">
      <h2>Phone notifications</h2>
      <p className="muted small">{PUSH_COPY[state]}</p>
      {state === 'off' ? (
        <button className="button" onClick={() => void toggle(true)} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      ) : state === 'on' ? (
        <button className="link-button small" onClick={() => void toggle(false)} disabled={busy}>
          Turn off on this phone
        </button>
      ) : state === 'install-first' ? (
        <Link to="/install" className="button button-ghost">
          How to add it
        </Link>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
