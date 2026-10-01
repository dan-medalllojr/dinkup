import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { isStaleChunkError, reloadWithLatest, triedRecently } from '../lib/appUpdate.ts';

// Replaces React Router's developer error screen with something a player can use.
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // An old installed version asking for files a newer deploy removed: update
  // to the new version on our own instead of showing an error.
  const stale = !notFound && isStaleChunkError(error) && !triedRecently();
  if (!notFound && !stale) console.error(error);

  useEffect(() => {
    if (stale) void reloadWithLatest();
  }, [stale]);

  if (stale) {
    return (
      <main className="page">
        <section className="card narrow center" role="status">
          <h1>Updating Dinkup…</h1>
          <p className="muted">A newer version is out. This takes a second.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card narrow center">
        <h1>{notFound ? 'Out of bounds' : 'Something went wrong'}</h1>
        <p className="muted">
          {notFound ? "That page doesn't exist." : 'This page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          {/* Also picks up a waiting new version, which a plain reload wouldn't. */}
          <button className="button" onClick={() => void reloadWithLatest()}>
            Reload
          </button>
          <Link to="/" className="button button-ghost">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
