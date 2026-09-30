import { Link } from 'react-router';
import { DemoButton } from '../components/DemoButton.tsx';
import { GameCard } from '../components/GameCard.tsx';
import { useGames } from '../lib/useGames.ts';
import { useAuth } from '../lib/auth.tsx';

export function HomePage() {
  const { user } = useAuth();
  const { games } = useGames('limit=3');

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
            <DemoButton />
          </div>
        )}
      </section>

      <section className="home-games">
        <div className="section-header">
          <h2>Upcoming games</h2>
          <Link to="/games" className="small">
            See all
          </Link>
        </div>
        {games === null ? (
          <p className="muted">Loading games…</p>
        ) : games.length === 0 ? (
          <p className="card muted">No games posted yet. {user ? <Link to="/games/new">Post the first one</Link> : null}</p>
        ) : (
          <ul className="game-list">
            {games.map((g) => (
              <li key={g.id}>
                <GameCard game={g} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/courts" className="card card-link">
        <h2>Find a court</h2>
        <p className="muted">Pickleball courts around Metro Cebu, on a map, with directions.</p>
      </Link>
    </>
  );
}
