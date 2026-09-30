import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { directionsUrl, meetsMinLevel, SKILL_LABELS, type Game, type GameDisplayStatus } from '@dinkup/shared';
import { Avatar } from '../components/Avatar.tsx';
import { Comments } from '../components/Comments.tsx';
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
  const location = useLocation();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<'join' | 'leave' | 'cancel' | null>(null);

  useEffect(() => {
    setGame(null);
    setError('');
    api<{ game: Game }>('GET', `/games/${id}`)
      .then((res) => setGame(res.game))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, [id]);

  // Join, leave, and cancel all return the updated game, so the page re-renders
  // from the server's view (e.g. someone else took the last spot meanwhile).
  async function act(action: 'join' | 'leave' | 'cancel', confirmText?: string) {
    if (!game || (confirmText && !window.confirm(confirmText))) return;
    setBusy(action);
    setActionError('');
    try {
      const res = await api<{ game: Game }>('POST', `/games/${game.id}/${action}`);
      setGame(res.game);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
      // The page may be stale; refresh so it shows why this failed.
      api<{ game: Game }>('GET', `/games/${game.id}`)
        .then((res) => {
          setGame(res.game);
          // Explain the common race in plain words instead of a bare "full".
          if (action === 'join' && res.game.status === 'full') {
            setActionError('Sorry, someone took the last spot just before you.');
          }
        })
        .catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="card">{error}</p>;
  if (!game) return <p className="muted">Loading…</p>;

  const isHost = user?.id === game.host.id;
  const isPlayer = !!user && game.players.some((p) => p.id === user.id);
  const levelOk = !user || meetsMinLevel(user.skillLevel, game.minSkillLevel);
  const joinable = game.status === 'open';
  const openSpots = game.capacity - game.players.length;
  const emptySlots = game.status === 'cancelled' ? 0 : Math.max(openSpots, 0);

  return (
    <>
      {game.isDemo ? (
        <p className="notice notice-demo" role="note">
          <strong>Demo game.</strong> This shows how Dinkup works. It's not a real meetup, so no one will be at the court.
        </p>
      ) : null}
      <section className="card game-hero">
        <div className="game-tags">
          <span className={`badge badge-${game.status}`}>{STATUS_LABELS[game.status]}</span>
          {game.isDemo ? <span className="badge badge-demo">Demo</span> : null}
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

      <section className="stack game-actions">
        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {!user && joinable ? (
          <Link to="/login" state={{ from: location.pathname }} className="button button-block">
            Log in to join
          </Link>
        ) : null}

        {user && !isPlayer && joinable && levelOk ? (
          <button className="button button-block" onClick={() => act('join')} disabled={busy !== null}>
            {busy === 'join' ? 'Joining…' : 'Join game'}
          </button>
        ) : null}

        {user && !isPlayer && joinable && !levelOk ? (
          <p className="notice">
            This game is for {game.minSkillLevel}+ players. You're {user.skillLevel}, so you can't join this one.
          </p>
        ) : null}

        {!isPlayer && game.status === 'full' && !actionError ? <p className="notice">This game is full.</p> : null}

        {isPlayer && !isHost && (game.status === 'open' || game.status === 'full') ? (
          <>
            <p className="notice notice-ok">You're in this game.</p>
            <button
              className="button button-ghost button-block"
              onClick={() => act('leave', 'Leave this game? Your spot will open up for someone else.')}
              disabled={busy !== null}
            >
              {busy === 'leave' ? 'Leaving…' : 'Leave game'}
            </button>
          </>
        ) : null}

        {isHost && (game.status === 'open' || game.status === 'full') ? (
          <button
            className="button button-ghost button-danger button-block"
            onClick={() => act('cancel', 'Cancel this game? Players who joined will see it as cancelled.')}
            disabled={busy !== null}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel game'}
          </button>
        ) : null}
      </section>

      <Comments gameId={game.id} hostId={game.host.id} isPlayer={isPlayer} />
    </>
  );
}
