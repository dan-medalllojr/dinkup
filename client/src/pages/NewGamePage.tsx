import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  addDaysToDate,
  createGameSchema,
  DEFAULT_DURATION_MIN,
  DURATION_OPTIONS,
  GAME_CAPACITY,
  manilaToIso,
  MAX_DAYS_AHEAD,
  todayInManila,
  type Court,
  type Game,
  type GameFormat,
  type SkillLevel,
} from '@dinkup/shared';
import { CourtMap } from '../components/CourtMap.tsx';
import { SelectField, TextField } from '../components/Field.tsx';
import { Segmented } from '../components/Segmented.tsx';
import { api, ApiError } from '../lib/api.ts';
import { errorsFromApi, validate, type FieldErrors } from '../lib/forms.ts';
import { levelOptions } from '../lib/labels.ts';
import { formatDuration } from '../lib/time.ts';

export function NewGamePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const today = todayInManila();

  const [values, setValues] = useState({
    courtId: params.get('court') ?? '',
    date: today,
    time: '18:00',
    durationMin: DEFAULT_DURATION_MIN as number,
    format: 'doubles' as GameFormat,
    minSkillLevel: '' as SkillLevel | '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    api<{ courts: Court[] }>('GET', '/courts')
      .then((res) => setCourts(res.courts))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load courts'));
  }, []);

  const court = courts?.find((c) => c.id === values.courtId) ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      courtId: values.courtId,
      startsAt: values.date && values.time ? manilaToIso(values.date, values.time) : '',
      durationMin: values.durationMin,
      format: values.format,
      minSkillLevel: values.minSkillLevel || null,
    };
    const { data, errors } = validate(createGameSchema, payload);
    setErrors(errors ?? {});
    setFormError('');
    if (!data) return;

    setSubmitting(true);
    try {
      const res = await api<{ game: Game }>('POST', '/games', data);
      navigate(`/games/${res.game.id}`, { replace: true });
    } catch (err) {
      const { form, fields } = errorsFromApi(err);
      setFormError(form);
      setErrors(fields);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="card">{loadError}</p>;

  return (
    <>
      <h1>Post a game</h1>
      <form onSubmit={onSubmit} noValidate className="stack">
        <section className="card">
          <h2>Where</h2>
          <p className="muted small">Tap a pin or choose from the list.</p>
          <CourtMap courts={courts ?? []} selectedId={values.courtId || null} onSelect={(id) => set('courtId', id)} userLocation={null} />
          <SelectField
            label="Court"
            value={values.courtId}
            onChange={(e) => set('courtId', e.target.value)}
            options={[
              { value: '', label: courts ? 'Choose a court…' : 'Loading courts…' },
              ...(courts ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.city})` })),
            ]}
            error={errors.courtId}
          />
          {court ? <p className="muted small">{[court.address, court.city].filter(Boolean).join(', ')}</p> : null}
        </section>

        <section className="card">
          <h2>When</h2>
          <div className="row">
            <TextField
              label="Date"
              type="date"
              min={today}
              max={addDaysToDate(today, MAX_DAYS_AHEAD - 1)}
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <TextField label="Start time" type="time" step={900} value={values.time} onChange={(e) => set('time', e.target.value)} />
          </div>
          {errors.startsAt ? <p className="field-error">{errors.startsAt}</p> : null}
          <p className="muted small">Times are Philippine time.</p>
          <SelectField
            label="Duration"
            value={String(values.durationMin)}
            onChange={(e) => set('durationMin', Number(e.target.value))}
            options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: formatDuration(m) }))}
            error={errors.durationMin}
          />
        </section>

        <section className="card">
          <h2>Who</h2>
          <Segmented
            label="Format"
            value={values.format}
            onChange={(f) => set('format', f)}
            options={[
              { value: 'singles', label: 'Singles', hint: `${GAME_CAPACITY.singles} players` },
              { value: 'doubles', label: 'Doubles', hint: `${GAME_CAPACITY.doubles} players` },
            ]}
          />
          <SelectField
            label="Minimum level"
            value={values.minSkillLevel}
            onChange={(e) => set('minSkillLevel', e.target.value as SkillLevel | '')}
            options={[{ value: '', label: 'Any level' }, ...levelOptions]}
            error={errors.minSkillLevel}
            hint="Shown to players browsing for games."
          />
        </section>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <button className="button button-block" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post game'}
        </button>
      </form>
    </>
  );
}
