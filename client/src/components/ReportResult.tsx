import { useState, type FormEvent } from 'react';
import { reportResultSchema, type Game, type MatchResult } from '@dinkup/shared';
import { z } from 'zod';
import { api, ApiError } from '../lib/api.ts';

type Props = { game: Game; meId: string; onReported: (r: MatchResult) => void };

/**
 * Only the winning side reports: the form is "Report your win". In doubles,
 * the reporter picks their partner and the other two are the losers.
 */
export function ReportResult({ game, meId, onReported }: Props) {
  const others = game.players.filter((p) => p.id !== meId);
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [games, setGames] = useState<[string, string][]>([['11', '']]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Editing the score clears the previous error.
  function setScore(i: number, side: 0 | 1, value: string) {
    setError('');
    setGames((g) => g.map((row, j) => (j === i ? (side === 0 ? [value.replace(/\D/g, ''), row[1]] : [row[0], value.replace(/\D/g, '')]) : row)));
  }

  const winners = game.format === 'singles' ? [meId] : [meId, partnerId].filter(Boolean);
  const losers = game.format === 'singles' ? others.map((p) => p.id) : others.filter((p) => p.id !== partnerId).map((p) => p.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (game.format === 'doubles' && !partnerId) return setError('Pick your partner');
    const parsed = reportResultSchema.safeParse({ winnerIds: winners, loserIds: losers, score: games.map(([a, b]) => [Number(a), Number(b)]) });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      return setError(flat.fieldErrors.score?.[0] ?? flat.formErrors[0] ?? Object.values(flat.fieldErrors)[0]?.[0] ?? 'Check the score');
    }
    setSaving(true);
    setError('');
    try {
      const res = await api<{ result: MatchResult }>('POST', `/games/${game.id}/result`, parsed.data);
      onReported(res.result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <section className="card stack-tight">
        <h2>How did it go?</h2>
        <p className="muted small">If your side won, report it here. The other side confirms it, and only then do wins count toward leveling up.</p>
        <button className="button button-block" onClick={() => setOpen(true)}>
          We won: report the result
        </button>
      </section>
    );
  }

  return (
    <form className="card stack-tight" onSubmit={submit} noValidate aria-labelledby="report-title">
      <h2 id="report-title">Report your win</h2>
      {game.format === 'doubles' ? (
        <fieldset className="field">
          <legend>Your partner</legend>
          <div className="partner-options">
            {others.map((p) => (
              <label key={p.id} className={partnerId === p.id ? 'segmented-option is-selected' : 'segmented-option'}>
                <input type="radio" name="partner" value={p.id} checked={partnerId === p.id} onChange={() => {
                    setPartnerId(p.id);
                    setError(''); // stale "Pick your partner" otherwise lingers
                  }}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="muted small">You beat {others.map((p) => p.name).join(' & ')}.</p>
      )}
      {game.format === 'doubles' && partnerId ? (
        <p className="muted small">
          You beat {others.filter((p) => p.id !== partnerId).map((p) => p.name).join(' & ')}.
        </p>
      ) : null}

      <div className="score-rows">
        <div className="score-head" aria-hidden>
          <span />
          <span>Your side</span>
          <span>Them</span>
        </div>
        {games.map(([a, b], i) => (
          <div className="score-row" key={i}>
            <span className="muted small">Game {i + 1}</span>
            <input inputMode="numeric" aria-label={`Game ${i + 1}, your side`} value={a} onChange={(e) => setScore(i, 0, e.target.value)} />
            <input inputMode="numeric" aria-label={`Game ${i + 1}, them`} value={b} onChange={(e) => setScore(i, 1, e.target.value)} />
          </div>
        ))}
        <div className="score-actions">
          {games.length < 5 ? (
            <button type="button" className="link-button small" onClick={() => setGames((g) => [...g, ['11', '']])}>
              + Add game
            </button>
          ) : null}
          {games.length > 1 ? (
            <button type="button" className="link-button small" onClick={() => setGames((g) => g.slice(0, -1))}>
              Remove last
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="result-actions">
        <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="button" disabled={saving}>
          {saving ? 'Reporting…' : 'Report win'}
        </button>
      </div>
    </form>
  );
}
