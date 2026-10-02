import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  CONFIRM_WINDOW_HOURS,
  CORRECTION_WINDOW_HOURS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  MIN_OPPONENT_ACCOUNT_DAYS,
  MIN_OPPONENT_CONFIRMED_RESULTS,
  POINTS_TO_LEVEL_UP,
  REPORT_WINDOW_HOURS,
  SAME_OPPONENT_CAP,
  SAME_OPPONENT_WINDOW_DAYS,
  SKILL_LEVELS,
  type Court,
  type FeedbackKind,
} from '@dinkup/shared';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

// What Dinkup is and how it works, inside the app (installed or not). The
// rules below come from the same constants the server enforces, so they
// can't drift apart.
export function AboutPage() {
  const { hash } = useLocation();
  // React Router doesn't scroll to #anchors on its own.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <article className="stack about">
      <header className="install-hero">
        <img src="/icons/icon-192.png" alt="" width={64} height={64} />
        <div>
          <h1>About Dinkup</h1>
          <p className="muted">Find a pickleball game in Cebu: post one at your court, fill the open spots, and level up with every confirmed win.</p>
        </div>
      </header>

      <nav className="card about-toc" aria-label="On this page">
        <a href="#how-it-works">How it works</a>
        <a href="#leveling">Points & levels</a>
        <a href="#courts">Courts</a>
        <a href="#demo">Demo games</a>
        <a href="#privacy">Privacy</a>
        <a href="#feedback">Send feedback</a>
      </nav>

      <section className="card" id="how-it-works">
        <h2>How it works</h2>
        <ol className="install-steps">
          <li>
            <strong>Find or post a game.</strong> Browse <Link to="/games">games</Link> near you, or post one at a court with a time, singles or doubles, and an optional minimum level.
          </li>
          <li>
            <strong>Join and play.</strong> Joining holds your spot. Use the game's comments to sort out the details.
          </li>
          <li>
            <strong>Report the result.</strong> After the game, the winners report the score within {REPORT_WINDOW_HOURS} hours. The other side confirms it within {CONFIRM_WINDOW_HOURS} hours, and
            only then does the win count.
          </li>
        </ol>
        <p className="muted small">
          Dinkup is free and installs from your browser, with no app store. <Link to="/install">Add it to your home screen</Link>.
        </p>
      </section>

      <section className="card" id="leveling">
        <h2>Points & levels</h2>
        <p>
          Levels go {SKILL_LEVELS.join(' → ')}. You start at the level you pick when you sign up. Each confirmed win can earn <strong>1 point</strong>, and at{' '}
          <strong>{POINTS_TO_LEVEL_UP} points</strong> you move up a level and start again at 0.
        </p>
        <p>A win doesn't earn a point when:</p>
        <ul>
          <li>your opponents are a lower level than you (in doubles, the average of the two),</li>
          <li>
            you've already beaten the same opponent {SAME_OPPONENT_CAP} times in {SAME_OPPONENT_WINDOW_DAYS} days,
          </li>
          <li>
            the opponent's account is newer than {MIN_OPPONENT_ACCOUNT_DAYS} days or has fewer than {MIN_OPPONENT_CONFIRMED_RESULTS} confirmed results.
          </li>
        </ul>
        <p className="muted small">
          These stop anyone from farming points off friends or fresh accounts. Every result shows the reason next to each winner, so a 0 is never a mystery. Your
          self-picked level locks after your first confirmed result. From then on, only wins move it.
        </p>
        <h3>If a result is wrong</h3>
        <p className="muted small">
          The losing side can dispute it. Then, within {CORRECTION_WINDOW_HOURS} hours, the side that actually won can report the correct result once, and the other side
          confirms or disputes it. A second dispute is final, and that game doesn't count.
        </p>
      </section>

      <section className="card" id="courts">
        <h2>Courts</h2>
        <p>
          Every court on the map is a real Metro Cebu venue, and each pin was checked by hand against the venue's own map listing or website. A wrong pin sends people to
          the wrong place, so courts we couldn't confirm aren't shown.
        </p>
        <p className="muted small">
          Missing your court? Logged-in players can add one from the <Link to="/courts">Courts</Link> tab, and it's labeled "Added by" them. Spotted a wrong pin?{' '}
          <a href="#feedback">Tell us below</a>.
        </p>
      </section>

      <section className="card" id="demo">
        <h2>Demo games</h2>
        <p className="muted small">
          So the app isn't empty, a rolling week of sample games is hosted by made-up players. They're always labeled <span className="badge badge-demo">Demo</span>, and
          nobody will be at the court for them. "Try the demo" logs you into a throwaway account that's deleted after a day.
        </p>
      </section>

      <section className="card" id="privacy">
        <h2>Privacy</h2>
        <ul className="muted small">
          <li>
            <strong>Location</strong> is only used if you allow it, to sort games and courts by distance. Courts are sorted on your phone. For games, a rounded position
            (about 10 m) is sent with the request, and Dinkup never saves it.
          </li>
          <li>
            <strong>Other players see</strong> your name, photo, level, points, and confirmed results. Your email stays private.
          </li>
          <li>
            <strong>Notifications</strong> are only sent to you about your own games and results. Phone notifications are off until you turn them on, and logging out turns
            them off on that phone.
          </li>
          <li>
            <strong>Maps and place search</strong> use OpenStreetMap services (OpenFreeMap, Photon, Nominatim) through our server. Google isn't involved, unless you paste a
            Google Maps link (our server reads the pin from it).
          </li>
        </ul>
      </section>


      <FeedbackForm />
    </article>
  );
}

function FeedbackForm() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const courtId = params.get('court');
  const [court, setCourt] = useState<Court | null>(null);
  const [kind, setKind] = useState<FeedbackKind>(courtId || params.get('kind') === 'court' ? 'court' : 'bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // the hidden bot trap
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courtId) return;
    api<{ court: Court }>('GET', `/courts/${courtId}`)
      .then((res) => setCourt(res.court))
      .catch(() => {});
  }, [courtId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      await api('POST', '/feedback', { kind, message, contact: user ? undefined : contact, courtId: court?.id, website });
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.message?.[0] ?? err.message) : "Couldn't send that. Check your connection and try again.");
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <section className="card" id="feedback" role="status">
        <h2>Thanks!</h2>
        <p className="muted">Your feedback was saved. Every message gets read.</p>
        <button className="link-button" onClick={() => { setMessage(''); setState('idle'); }}>
          Send another
        </button>
      </section>
    );
  }

  return (
    <form className="card stack-tight" id="feedback" onSubmit={submit} noValidate>
      <h2>Send feedback</h2>
      <p className="muted small">Found a bug, a wrong pin, or a missing court? Have an idea? It goes straight to the person who builds Dinkup.</p>
      {court ? (
        <p className="notice">
          About: <strong>{court.name}</strong>, {court.city}
        </p>
      ) : null}
      <label className="field">
        <span>What's it about?</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
          {FEEDBACK_KINDS.map((k) => (
            <option key={k} value={k}>
              {FEEDBACK_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={4}
          required
          placeholder={kind === 'court' ? 'Which court, and what should change? A Google Maps link helps.' : 'What happened, or what would make Dinkup better?'}
        />
      </label>
      {user ? null : (
        <label className="field">
          <span>
            Email or phone <span className="muted">(optional, if you'd like a reply)</span>
          </span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} autoComplete="email" />
        </label>
      )}
      {/* Bot trap: hidden from people and screen readers; bots fill it in. */}
      <input className="visually-hidden" tabIndex={-1} aria-hidden autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
