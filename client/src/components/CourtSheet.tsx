import { useEffect } from 'react';
import { Link } from 'react-router';
import { directionsUrl, type Court, type Game } from '@dinkup/shared';
import { useGames } from '../lib/useGames.ts';
import { CourtGames } from './CourtGames.tsx';
import { formatKm } from './GameCard.tsx';

// How far (px) the map shifts a selected pin up so the sheet doesn't cover it.
// The map sits inside the page, not full-screen, so a small nudge is enough.
export const SHEET_OFFSET = 150;

type Props = {
  court: Court;
  onClose: () => void;
  distanceKm?: number | null;
  /** Already-loaded games at this court (e.g. the filtered Games list); fetched otherwise. */
  games?: Game[];
};

// Slides up from the bottom when a court pin is tapped.
export function CourtSheet({ court, onClose, distanceKm = null, games }: Props) {
  const fetched = useGames(games ? '' : `court=${court.id}&limit=5`, { skip: Boolean(games) });
  const list = games ?? fetched.games;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section className="sheet" role="dialog" aria-modal="false" aria-labelledby="sheet-title">
      <div className="sheet-handle" aria-hidden />
      <header className="sheet-header">
        <div>
          <h2 id="sheet-title">{court.name}</h2>
          <p className="muted small">
            {[court.address, court.city].filter(Boolean).join(', ')}
            {distanceKm !== null ? ` · ${formatKm(distanceKm)}` : ''}
          </p>
          {court.addedBy ? <span className="badge badge-demo">Added by {court.addedBy.name}</span> : null}
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="sheet-actions">
        <a className="button button-ghost button-small" href={directionsUrl(court)} target="_blank" rel="noreferrer">
          Directions
        </a>
        <Link className="button button-small" to={`/games/new?court=${court.id}`}>
          Post a game here
        </Link>
      </div>
      <h3 className="sheet-subtitle">Upcoming games</h3>
      <CourtGames games={list} />
      <p className="small sheet-report">
        <Link to={`/about?court=${court.id}#feedback`}>Wrong pin or details? Tell us</Link>
      </p>
    </section>
  );
}
