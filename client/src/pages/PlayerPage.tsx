import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { PublicUser } from '@dinkup/shared';
import { Avatar } from '../components/Avatar.tsx';
import { api, ApiError } from '../lib/api.ts';
import { FORMAT_LABELS, levelLabel } from '../lib/labels.ts';

export function PlayerPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPlayer(null);
    setError('');
    api<{ user: PublicUser }>('GET', `/users/${id}`)
      .then((res) => setPlayer(res.user))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, [id]);

  if (error) return <p className="card">{error}</p>;
  if (!player) return <p className="muted">Loading…</p>;

  const joined = new Date(player.createdAt).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  return (
    <section className="card profile-summary">
      <Avatar name={player.name} photoUrl={player.photoUrl} size={72} />
      <div>
        <h1>{player.name}</h1>
        <p className="muted">
          {levelLabel(player.skillLevel)} · {FORMAT_LABELS[player.preferredFormat]}
        </p>
        <p className="muted small">Playing since {joined}</p>
      </div>
    </section>
  );
}
