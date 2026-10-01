import { useState } from 'react';
import { Link } from 'react-router';
import { POINTS_NOTES, TIMEZONE, type MatchResult } from '@dinkup/shared';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

const deadline = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' });

const STATUS = {
  pending: { label: 'Waiting for confirmation', badge: 'badge' },
  confirmed: { label: 'Confirmed', badge: 'badge badge-open' },
  disputed: { label: 'Disputed', badge: 'badge badge-cancelled' },
  expired: { label: 'Expired, not confirmed in time', badge: 'badge badge-demo' },
} as const;

const names = (ps: { id: string; name: string }[]) =>
  ps.map((p, i) => (
    <span key={p.id}>
      {i > 0 ? ' & ' : ''}
      <Link to={`/players/${p.id}`}>{p.name}</Link>
    </span>
  ));

/** A reported result, with confirm/dispute for the losing side while pending. */
export function ResultCard({ result, onChange }: { result: MatchResult; onChange: (r: MatchResult) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null);
  const [error, setError] = useState('');
  const iLost = !!user && result.losers.some((p) => p.id === user.id);
  const canAnswer = iLost && result.status === 'pending';

  async function act(action: 'confirm' | 'dispute') {
    if (action === 'dispute' && !window.confirm("Dispute this result? It won't count for anyone, and it can't be reported again.")) return;
    setBusy(action);
    setError('');
    try {
      const res = await api<{ result: MatchResult }>('POST', `/results/${result.id}/${action}`);
      onChange(res.result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card result-card" aria-labelledby="result-title">
      <div className="section-header">
        <h2 id="result-title">Result</h2>
        <span className={STATUS[result.status].badge}>{STATUS[result.status].label}</span>
      </div>
      <p className="result-line">
        <strong>{names(result.winners)}</strong> beat {names(result.losers)}
      </p>
      <p className="result-score">{result.score}</p>

      {result.status === 'confirmed' ? (
        <ul className="result-points">
          {result.winners.map((w) => (
            <li key={w.id} className={w.points > 0 ? 'is-awarded' : undefined}>
              <span>{w.name}</span>
              <span>
                {w.pointsNote ? POINTS_NOTES[w.pointsNote] : ''}
                {w.leveledUpTo ? <strong className="level-up"> · Level up to {w.leveledUpTo}!</strong> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {result.status === 'pending' ? (
        <p className="muted small">
          Reported by {result.reportedBy.name}. {iLost ? 'Confirm' : `${result.losers.map((l) => l.name).join(' or ')} must confirm`} by{' '}
          {deadline.format(new Date(result.confirmBy))}, or it expires and counts for no one.
        </p>
      ) : null}
      {result.status === 'disputed' ? <p className="muted small">The losing side disputed this result, so it doesn't count.</p> : null}

      {canAnswer ? (
        <div className="result-actions">
          <button className="button" onClick={() => act('confirm')} disabled={busy !== null}>
            {busy === 'confirm' ? 'Confirming…' : 'Confirm result'}
          </button>
          <button className="button button-ghost button-danger" onClick={() => act('dispute')} disabled={busy !== null}>
            {busy === 'dispute' ? 'Disputing…' : 'Dispute'}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
