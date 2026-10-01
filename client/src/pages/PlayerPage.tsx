import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { MatchResult, PublicUser } from '@dinkup/shared';
import { Avatar } from '../components/Avatar.tsx';
import { ResultList } from '../components/ResultList.tsx';
import { api, ApiError } from '../lib/api.ts';
import { FORMAT_LABELS, levelLabel } from '../lib/labels.ts';
import { useReconnect } from '../lib/useReconnect.ts';

export function PlayerPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  const reconnect = useReconnect();
  const [history, setHistory] = useState<MatchResult[] | null>(null);

  useEffect(() => {
    setPlayer(null);
    setError('');
    api<{ user: PublicUser }>('GET', `/users/${id}`)
      .then((res) => setPlayer(res.user))
      .then(() => api<{ results: MatchResult[] }>('GET', `/users/${id}/results`))
      .then((res) => setHistory(res.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, [id, reconnect]);

  if (error) return <p className="card">{error}</p>;
  if (!player) return <p className="muted">Loading…</p>;

  const joined = new Date(player.createdAt).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <>
    <section className="card profile-summary">
      <Avatar name={player.name} photoUrl={player.photoUrl} size={72} />
      <div>
        <h1>
          {player.name} {player.isDemo ? <span className="badge badge-demo">Demo</span> : null}
        </h1>
        <p className="muted">
          {levelLabel(player.skillLevel)} · {FORMAT_LABELS[player.preferredFormat]}
        </p>
        <p className="muted small">Playing since {joined}</p>
      </div>
    </section>
    <section className="home-games">
      <div className="section-header">
        <h2>Match history</h2>
      </div>
      {history === null ? (
        <p className="muted">Loading…</p>
      ) : history.length === 0 ? (
        <p className="card muted">No confirmed results yet.</p>
      ) : (
        <ResultList results={history} playerId={player.id} />
      )}
    </section>
    </>
  );
}
