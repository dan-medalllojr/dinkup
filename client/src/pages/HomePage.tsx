import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MatchResult } from '@dinkup/shared';
import { api } from '../lib/api.ts';
import { DemoButton } from '../components/DemoButton.tsx';
import { GameCard } from '../components/GameCard.tsx';
import { InstallBanner } from '../components/InstallBanner.tsx';
import { NearbyCourts, ShowMore } from '../components/NearbyCourts.tsx';
import { RadiusPicker } from '../components/RadiusPicker.tsx';
import { useGames } from '../lib/useGames.ts';
import { useGeolocation } from '../lib/useGeolocation.ts';
import { useAuth } from '../lib/auth.tsx';
import { useNearRadius } from '../lib/useNearRadius.ts';

const SHOWN = 5;

export function HomePage() {
  const { user } = useAuth();
  const geo = useGeolocation();
  const [radius, setRadius] = useNearRadius();
  const [showAllGames, setShowAllGames] = useState(false);
  const near = geo.location ? `&near=${geo.location.lat.toFixed(4)},${geo.location.lng.toFixed(4)}&within=${radius}` : '';
  // Wait the moment it takes to learn whether location is already allowed, so
  // the list doesn't flip from "soonest" to "nearest" right after it appears.
  // Near me: every game in range (the API caps it). Otherwise the next 3.
  const { games, error } = useGames(near ? `limit=50${near}` : 'limit=3', { skip: geo.checking });
  const shownGames = games && !showAllGames ? games.slice(0, SHOWN) : games;
  const [pending, setPending] = useState<MatchResult[]>([]);
  useEffect(() => {
    if (!user) return setPending([]);
    api<{ results: MatchResult[] }>('GET', '/results/pending')
      .then((res) => setPending(res.results))
      .catch(() => {});
  }, [user]);

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

      {pending.length > 0 ? (
        <Link to={`/games/${pending[0]!.gameId}`} className="card card-link notice-warn">
          <strong>
            {pending.length === 1 ? `${pending[0]!.reportedBy.name} reported a win over you.` : `${pending.length} results are waiting for you.`}
          </strong>{' '}
          <span className="muted">Confirm or dispute it before it expires.</span>
        </Link>
      ) : null}

      <InstallBanner />

      <section className="home-games">
        <div className="section-header">
          <h2>{geo.location ? `Games within ${radius} km` : 'Upcoming games'}</h2>
          <Link to="/games" className="small">
            See all
          </Link>
        </div>
        {!geo.location && !geo.checking ? (
          <button className="button button-ghost button-small near-me" onClick={geo.locate} disabled={geo.locating}>
            {geo.locating ? 'Locating…' : 'Show games and courts near me'}
          </button>
        ) : null}
        {geo.error ? <p className="form-error">{geo.error}</p> : null}
        {geo.location ? (
          <RadiusPicker
            value={radius}
            onChange={(km) => {
              setRadius(km);
              setShowAllGames(false);
            }}
          />
        ) : null}
        {error && games === null ? (
          <p className="card muted">{error}</p>
        ) : games === null ? (
          <p className="muted">Loading games…</p>
        ) : games.length === 0 ? (
          <p className="card muted">
            {geo.location ? `No games within ${radius} km yet.` : 'No games posted yet.'}{' '}
            {user ? <Link to="/games/new">Post the first one</Link> : null}
          </p>
        ) : (
          <>
            <ul className="game-list">
              {shownGames!.map((g) => (
                <li key={g.id}>
                  <GameCard game={g} />
                </li>
              ))}
            </ul>
            {geo.location ? <ShowMore hidden={games.length - shownGames!.length} what="game" onClick={() => setShowAllGames(true)} /> : null}
          </>
        )}
      </section>

      {geo.location ? <NearbyCourts location={geo.location} radiusKm={radius} noGames={games !== null && games.length === 0} /> : null}

      <Link to="/courts" className="card card-link">
        <h2>Find a court</h2>
        <p className="muted">Pickleball courts around Metro Cebu, on a map, with directions.</p>
      </Link>

      <Link to="/install" className="card card-link">
        <h2>Invite your group</h2>
        <p className="muted">Share a link or QR code that installs Dinkup on any phone.</p>
      </Link>
    </>
  );
}
