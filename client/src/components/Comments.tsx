import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { COMMENT_MAX_LENGTH, createCommentSchema, type GameComment } from '@dinkup/shared';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { relativeTime } from '../lib/relativeTime.ts';
import { Avatar } from './Avatar.tsx';

// New comments show up without a refresh ("running 10 min late" is only
// useful if the others see it). Polls only while the tab is visible.
const POLL_MS = 20_000;

type Props = { gameId: string; hostId: string; isPlayer: boolean };

export function Comments({ gameId, hostId, isPlayer }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [comments, setComments] = useState<GameComment[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [, setTick] = useState(0); // re-render so "5 min ago" stays current

  const load = useCallback(
    (signal?: AbortSignal) =>
      api<{ comments: GameComment[] }>('GET', `/games/${gameId}/comments`, undefined, { signal })
        .then((res) => {
          setComments(res.comments);
          setLoadError('');
        })
        .catch((err) => {
          if (signal?.aborted) return;
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load comments");
        }),
    [gameId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(controller.signal);
        setTick((t) => t + 1);
      }
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load(controller.signal);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const parsed = createCommentSchema.safeParse({ body: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid comment');
      return;
    }
    setPosting(true);
    setError('');
    try {
      const res = await api<{ comment: GameComment }>('POST', `/games/${gameId}/comments`, parsed.data);
      setComments((c) => [...(c ?? []), res.comment]);
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api('DELETE', `/games/${gameId}/comments/${id}`);
      setComments((c) => (c ?? []).filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  // Cmd/Ctrl+Enter posts; plain Enter makes a new line.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
  }

  const remaining = COMMENT_MAX_LENGTH - draft.length;

  return (
    <section className="card comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments</h2>

      {loadError && comments === null ? <p className="form-error">{loadError}</p> : null}
      {comments === null && !loadError ? <p className="muted small">Loading…</p> : null}
      {comments?.length === 0 ? <p className="muted small">No comments yet.</p> : null}

      {comments && comments.length > 0 ? (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <Avatar name={c.author.name} photoUrl={c.author.photoUrl} size={32} />
              <div className="comment-main">
                <div className="comment-meta">
                  <Link to={`/players/${c.author.id}`} className="comment-author">
                    {c.author.name}
                  </Link>
                  {c.author.id === hostId ? <span className="badge badge-host-small">Host</span> : null}
                  <time dateTime={c.createdAt} className="muted small" title={new Date(c.createdAt).toLocaleString()}>
                    {relativeTime(c.createdAt)}
                  </time>
                  {user && (user.id === c.author.id || user.id === hostId) ? (
                    <button className="comment-delete" onClick={() => remove(c.id)} aria-label="Delete comment">
                      Delete
                    </button>
                  ) : null}
                </div>
                {/* Plain text: React escapes it, and pre-wrap keeps line breaks. */}
                <p className="comment-body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isPlayer ? (
        <form onSubmit={submit} className="comment-form" noValidate>
          <label htmlFor="comment-draft" className="visually-hidden">
            Add a comment
          </label>
          <textarea
            id="comment-draft"
            rows={2}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Running late? Which court? Let the others know."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="comment-form-footer">
            <span className={remaining < 50 ? 'small form-error' : 'small muted'}>{remaining < 100 ? `${remaining} left` : ''}</span>
            <button className="button button-small" disabled={posting || !draft.trim()}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : user ? (
        <p className="muted small">Join the game to comment.</p>
      ) : (
        <p className="muted small">
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          and join to comment.
        </p>
      )}
    </section>
  );
}
