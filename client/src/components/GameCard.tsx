import { Link } from 'react-router';
import { TIMEZONE, type GameListItem } from '@dinkup/shared';
import { Avatar } from './Avatar.tsx';

const weekday = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, weekday: 'short' });
const dayOfMonth = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, day: 'numeric' });
const time = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit' });

export function formatKm(km: number) {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function GameCard({ game }: { game: GameListItem }) {
  const start = new Date(game.startsAt);
  const spotsLeft = game.capacity - game.players.length;

  return (
    <Link to={`/games/${game.id}`} className="card game-card">
      <div className="game-card-date" aria-hidden>
        <span>{weekday.format(start)}</span>
        <strong>{dayOfMonth.format(start)}</strong>
      </div>
      <div className="game-card-body">
        <span className="game-card-time">
          {time.format(start)} – {time.format(new Date(game.endsAt))}
        </span>
        <span className="game-card-court">
          {game.court.name} <span className="muted">· {game.court.city}</span>
        </span>
        <span className="game-tags">
          <span className="badge">{game.format === 'singles' ? 'Singles' : 'Doubles'}</span>
          <span className="badge">{game.minSkillLevel ? `${game.minSkillLevel}+` : 'Any level'}</span>
          {game.status === 'full' ? (
            <span className="badge badge-full">Full</span>
          ) : (
            <span className="badge badge-open">
              {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
            </span>
          )}
        </span>
      </div>
      <div className="game-card-side">
        {game.distanceKm !== null ? <span className="distance">{formatKm(game.distanceKm)}</span> : null}
        <span className="avatar-stack" aria-label={`${game.players.length} of ${game.capacity} players`}>
          {game.players.slice(0, 4).map((p) => (
            <Avatar key={p.id} name={p.name} photoUrl={p.photoUrl} size={24} />
          ))}
        </span>
      </div>
    </Link>
  );
}
