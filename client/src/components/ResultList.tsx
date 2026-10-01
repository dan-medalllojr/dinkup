import { Link } from 'react-router';
import { POINTS_NOTES, TIMEZONE, type MatchResult } from '@dinkup/shared';

const day = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, month: 'short', day: 'numeric' });

/** Match history from one player's point of view. */
export function ResultList({ results, playerId }: { results: MatchResult[]; playerId: string }) {
  return (
    <ul className="result-list">
      {results.map((r) => {
        const won = r.winners.find((w) => w.id === playerId);
        const opponents = (won ? r.losers : r.winners).map((p) => p.name).join(' & ');
        return (
          <li key={r.id}>
            <Link to={`/games/${r.gameId}`}>
              <span className={won ? 'badge badge-open' : 'badge'}>{won ? 'W' : 'L'}</span>
              <span className="result-list-main">
                <strong>vs {opponents}</strong>
                <span className="muted small">
                  {r.score} · {r.game.courtName} · {day.format(new Date(r.game.startsAt))}
                </span>
                {won?.pointsNote ? (
                  <span className="small">
                    {POINTS_NOTES[won.pointsNote]}
                    {won.leveledUpTo ? ` · Level up to ${won.leveledUpTo}` : ''}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
