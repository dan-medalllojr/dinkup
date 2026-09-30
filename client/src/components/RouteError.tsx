import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

// Replaces React Router's developer error screen with something a player can use.
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);

  return (
    <main className="page">
      <section className="card narrow center">
        <h1>{notFound ? 'Out of bounds' : 'Something went wrong'}</h1>
        <p className="muted">
          {notFound ? "That page doesn't exist." : 'This page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <button className="button" onClick={() => window.location.reload()}>
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
