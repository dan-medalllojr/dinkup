import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { directionsUrl, SKILL_LABELS, type Game, type GameDisplayStatus } from '@dinkup/shared';
import { Avatar } from '../components/Avatar.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { formatGameWhen } from '../lib/time.ts';

const STATUS_LABELS: Record<GameDisplayStatus, string> = {
  open: 'Open',
  full: 'Full',
  cancelled: 'Cancelled',
  completed: 'Played',
};

export function GamePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setGame(null);
    setError('');
    api<{ game: Game }>('GET', `/games/${id}`)
      .then((res) => setGame(res.game))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, [id]);

  async function cancel() {
    if (!game || !window.confirm('Cancel this game? Players who joined will see it as cancelled.')) return;
    setCancelling(true);
    setActionError('');
    try {
      const res = await api<{ game: Game }>('POST', `/games/${game.id}/cancel`);
      setGame(res.game);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <p className="card">{error}</p>;
  if (!game) return <p className="muted">Loading…</p>;

  const isHost = user?.id === game.host.id;
  const openSpots = game.capacity - game.players.length;
  const emptySlots = game.status === 'cancelled' ? 0 : Math.max(openSpots, 0);

  return (
    <>
      <section className="card game-hero">
        <div className="game-tags">
          <span className={`badge badge-${game.status}`}>{STATUS_LABELS[game.status]}</span>
          <span className="badge">{game.format === 'singles' ? 'Singles' : 'Doubles'}</span>
          <span className="badge">
            {game.minSkillLevel ? `${game.minSkillLevel}+ ${SKILL_LABELS[game.minSkillLevel]}` : 'Any level'}
          </span>
        </div>
        <h1 className={game.status === 'cancelled' ? 'is-cancelled' : undefined}>{formatGameWhen(game.startsAt, game.endsAt)}</h1>
        <p className="game-court">
          <strong>{game.court.name}</strong>
          <span className="muted"> · {[game.court.address, game.court.city].filter(Boolean).join(', ')}</span>
        </p>
        <a className="button button-ghost button-small" href={directionsUrl(game.court)} target="_blank" rel="noreferrer">
          Get directions
        </a>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Players</h2>
          <span className="muted small">
            {game.players.length} of {game.capacity}
            {game.status === 'open' ? ` · ${openSpots} spot${openSpots === 1 ? '' : 's'} left` : ''}
          </span>
        </div>
        <ul className="player-list">
          {game.players.map((p) => (
            <li key={p.id}>
              <Link to={`/players/${p.id}`} className="player">
                <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                <span className="player-name">{p.name}</span>
                <span className="muted small">{p.skillLevel}</span>
                {p.id === game.host.id ? <span className="badge badge-host">Host</span> : null}
              </Link>
            </li>
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <li key={`empty-${i}`} className="player player-empty">
              <span className="avatar avatar-empty" style={{ width: 40, height: 40 }} aria-hidden />
              <span className="muted">Open spot</span>
            </li>
          ))}
        </ul>
      </section>

      {isHost && game.status !== 'cancelled' && game.status !== 'completed' ? (
        <section className="stack">
          {actionError ? <p className="form-error">{actionError}</p> : null}
          <button className="button button-ghost button-danger button-block" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel game'}
          </button>
        </section>
      ) : null}
    </>
  );
}
