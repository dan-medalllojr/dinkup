import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="card narrow center">
      <h1>Out of bounds</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link to="/" className="button">
        Back home
      </Link>
    </section>
  );
}
