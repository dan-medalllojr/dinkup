import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { updateProfileSchema, type Game, type PreferredFormat, type SkillLevel } from '@dinkup/shared';
import { Avatar } from '../components/Avatar.tsx';
import { GameCard } from '../components/GameCard.tsx';
import { api } from '../lib/api.ts';
import { SelectField, TextField } from '../components/Field.tsx';
import { useAuth } from '../lib/auth.tsx';
import { errorsFromApi, validate, type FieldErrors } from '../lib/forms.ts';
import { FORMAT_LABELS, formatOptions, levelLabel, levelOptions } from '../lib/labels.ts';

const POINTS_TO_LEVEL_UP = 5;

export function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  // RequireAuth guarantees a user here.
  const me = user!;
  const [values, setValues] = useState({
    name: me.name,
    skillLevel: me.skillLevel as SkillLevel,
    preferredFormat: me.preferredFormat as PreferredFormat,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [myGames, setMyGames] = useState<Game[] | null>(null);

  useEffect(() => {
    api<{ games: Game[] }>('GET', '/games/mine')
      .then((res) => setMyGames(res.games))
      .catch(() => setMyGames([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors } = validate(updateProfileSchema, values);
    setErrors(errors ?? {});
    setStatus(null);
    if (!data) return;

    setSaving(true);
    try {
      await updateProfile(data);
      setStatus({ kind: 'ok', text: 'Profile saved' });
    } catch (err) {
      const { form, fields } = errorsFromApi(err);
      setErrors(fields);
      setStatus({ kind: 'error', text: form });
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <>
      <section className="card profile-summary">
        <Avatar name={me.name} photoUrl={me.photoUrl} size={72} />
        <div>
          <h1>{me.name}</h1>
          <p className="muted">
            {levelLabel(me.skillLevel)} · {FORMAT_LABELS[me.preferredFormat]}
          </p>
          <div className="points" aria-label={`${me.skillPoints} of ${POINTS_TO_LEVEL_UP} points to next level`}>
            <div className="points-bar">
              <span style={{ width: `${(me.skillPoints / POINTS_TO_LEVEL_UP) * 100}%` }} />
            </div>
            <span className="muted small">
              {me.skillPoints}/{POINTS_TO_LEVEL_UP} points to next level
            </span>
          </div>
        </div>
      </section>

      <section className="home-games">
        <div className="section-header">
          <h2>Your upcoming games</h2>
          <Link to="/games" className="small">
            Find games
          </Link>
        </div>
        {myGames === null ? (
          <p className="muted">Loading…</p>
        ) : myGames.length === 0 ? (
          <p className="card muted">
            You're not in any upcoming games. <Link to="/games">Find one</Link> or <Link to="/games/new">post your own</Link>.
          </p>
        ) : (
          <ul className="game-list">
            {myGames.map((g) => (
              <li key={g.id}>
                <GameCard game={g} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Edit profile</h2>
        <form onSubmit={onSubmit} noValidate>
          <TextField
            label="Name"
            autoComplete="name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            error={errors.name}
          />
          <SelectField
            label="Skill level"
            value={values.skillLevel}
            onChange={(e) => setValues({ ...values, skillLevel: e.target.value as SkillLevel })}
            options={levelOptions}
            error={errors.skillLevel}
          />
          <SelectField
            label="Preferred format"
            value={values.preferredFormat}
            onChange={(e) => setValues({ ...values, preferredFormat: e.target.value as PreferredFormat })}
            options={formatOptions}
            error={errors.preferredFormat}
          />
          {status ? (
            <p className={status.kind === 'ok' ? 'form-ok' : 'form-error'} role="status">
              {status.text}
            </p>
          ) : null}
          <button className="button button-block" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <p className="muted small center">Signed in as {me.email}</p>
      <button className="button button-ghost button-block" onClick={onLogout}>
        Log out
      </button>
    </>
  );
}
