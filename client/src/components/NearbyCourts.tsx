import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { distanceKm, type Court, type LatLng } from '@dinkup/shared';
import { api } from '../lib/api.ts';
import { formatKm } from './GameCard.tsx';

const SHOWN = 5;
const FALLBACK = 3;

/** "Show 4 more courts", for lists cut to their first few. */
export function ShowMore({ hidden, what, onClick }: { hidden: number; what: string; onClick: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button className="button button-ghost button-small show-more" onClick={onClick}>
      Show {hidden} more {hidden === 1 ? what : `${what}s`}
    </button>
  );
}

// Every court within the chosen distance, whether or not anyone has posted a
// game there, so a player near a quiet court still finds somewhere to play.
// If none are in range, the closest few are shown instead.
export function NearbyCourts({ location, radiusKm, noGames }: { location: LatLng; radiusKm: number; noGames: boolean }) {
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<{ courts: Court[] }>('GET', '/courts', undefined, { signal: controller.signal })
      .then((res) => setCourts(res.courts))
      .catch(() => {}); // the Courts tab still works; this section just stays hidden
    return () => controller.abort();
  }, []);
  useEffect(() => setShowAll(false), [radiusKm]);

  const byDistance = useMemo(
    () => (courts ?? []).map((court) => ({ court, km: distanceKm(location, court) })).sort((a, b) => a.km - b.km),
    [courts, location],
  );
  if (byDistance.length === 0) return null;

  const inRange = byDistance.filter((c) => c.km <= radiusKm);
  const list = inRange.length > 0 ? inRange : byDistance.slice(0, FALLBACK);
  const shown = showAll ? list : list.slice(0, SHOWN);

  return (
    <section className="home-courts">
      <div className="section-header">
        <h2>{inRange.length > 0 ? `Courts within ${radiusKm} km` : 'Closest courts'}</h2>
        <Link to="/courts" className="small">
          All courts
        </Link>
      </div>
      {inRange.length === 0 ? (
        <p className="muted small">No courts within {radiusKm} km. These are the closest.</p>
      ) : noGames ? (
        <p className="muted small">No games here yet. These courts are in range; post the first one.</p>
      ) : null}
      <ul className="court-list">
        {shown.map(({ court, km }) => (
          <li key={court.id}>
            <Link to={`/courts?court=${court.id}`} className="card card-link court-item">
              <span className="court-item-main">
                <span className="court-name">{court.name}</span>
                <span className="muted small">
                  {court.city} · {court.upcomingGames > 0 ? `${court.upcomingGames} upcoming ${court.upcomingGames === 1 ? 'game' : 'games'}` : 'No games yet'}
                </span>
              </span>
              <span className="court-item-side">
                <span className="distance">{formatKm(km)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ShowMore hidden={list.length - shown.length} what="court" onClick={() => setShowAll(true)} />
    </section>
  );
}
