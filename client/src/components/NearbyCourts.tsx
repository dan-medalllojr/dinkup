import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { distanceKm, type Court, type LatLng } from '@dinkup/shared';
import { api } from '../lib/api.ts';
import { formatKm } from './GameCard.tsx';

const SHOWN = 3;

// The closest courts, whether or not anyone has posted a game there, so a
// player near a quiet court still finds somewhere to play (and to post a game).
export function NearbyCourts({ location, noGames }: { location: LatLng; noGames: boolean }) {
  const [courts, setCourts] = useState<Court[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<{ courts: Court[] }>('GET', '/courts', undefined, { signal: controller.signal })
      .then((res) => setCourts(res.courts))
      .catch(() => {}); // the Courts tab still works; this section just stays hidden
    return () => controller.abort();
  }, []);

  const nearest = useMemo(
    () =>
      (courts ?? [])
        .map((court) => ({ court, km: distanceKm(location, court) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, SHOWN),
    [courts, location],
  );
  if (nearest.length === 0) return null;

  return (
    <section className="home-courts">
      <div className="section-header">
        <h2>Courts near you</h2>
        <Link to="/courts" className="small">
          All courts
        </Link>
      </div>
      {noGames ? <p className="muted small">No games near you yet. These courts are close; post the first one.</p> : null}
      <ul className="court-list">
        {nearest.map(({ court, km }) => (
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
    </section>
  );
}
