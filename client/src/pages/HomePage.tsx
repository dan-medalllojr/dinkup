import { Link } from 'react-router';
import { useAuth } from '../lib/auth.tsx';

export function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <h1>Find a pickleball game in Cebu.</h1>
        <p>Post a game at your court, fill the open slots, and level up with every confirmed win.</p>
        {user ? (
          <>
            <p className="hero-greeting">Welcome back, {user.name.split(' ')[0]}.</p>
            <div className="hero-actions">
              <Link to="/games/new" className="button">
                Post a game
              </Link>
            </div>
          </>
        ) : (
          <div className="hero-actions">
            <Link to="/register" className="button">
              Get started
            </Link>
            <Link to="/login" className="button button-ghost">
              Log in
            </Link>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Upcoming games</h2>
        <p className="muted">Browsing and joining games near you is coming next.</p>
      </section>

      <Link to="/courts" className="card card-link">
        <h2>Find a court</h2>
        <p className="muted">Pickleball courts around Metro Cebu, on a map, with directions.</p>
      </Link>
    </>
  );
}
