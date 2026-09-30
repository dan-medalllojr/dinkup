import { Link } from 'react-router';
import { TIMEZONE, type Game } from '@dinkup/shared';

const when = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Compact list of games at one court, for the bottom sheet and the post form. */
export function CourtGames({ games, empty = 'No upcoming games here yet.' }: { games: Game[] | null; empty?: string }) {
  if (games === null) return <p className="muted small">Loading games…</p>;
  if (games.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <ul className="court-games">
      {games.map((g) => {
        const left = g.capacity - g.players.length;
        return (
          <li key={g.id}>
            <Link to={`/games/${g.id}`}>
              <span className="court-games-when">{when.format(new Date(g.startsAt))}</span>
              <span className="muted small">
                {g.format === 'singles' ? 'Singles' : 'Doubles'} · {g.minSkillLevel ? `${g.minSkillLevel}+` : 'Any level'}
                {g.isDemo ? ' · Demo' : ''}
              </span>
              <span className={g.status === 'full' ? 'badge badge-full' : 'badge badge-open'}>
                {g.status === 'full' ? 'Full' : `${left} left`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
