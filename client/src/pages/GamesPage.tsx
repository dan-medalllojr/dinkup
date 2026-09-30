import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDaysToDate, distanceKm, GAME_FORMATS, SKILL_LEVELS, todayInManila, type Court, type GameFormat, type SkillLevel } from '@dinkup/shared';
import { SelectField } from '../components/Field.tsx';
import { CourtSheet, SHEET_OFFSET } from '../components/CourtSheet.tsx';
import { GameCard } from '../components/GameCard.tsx';
import { useAuth } from '../lib/auth.tsx';
import { levelOptions } from '../lib/labels.ts';
import { useGames } from '../lib/useGames.ts';
import { useGeolocation } from '../lib/useGeolocation.ts';

// Leaflet only loads if someone switches to the map.
const CourtMap = lazy(() => import('../components/CourtMap.tsx').then((m) => ({ default: m.CourtMap })));

const shortDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

export function GamesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const geo = useGeolocation();
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  // Filters live in the URL, so they survive refresh and the back button and can be shared.
  const date = params.get('date') ?? '';
  const level = (SKILL_LEVELS as readonly string[]).includes(params.get('level') ?? '') ? (params.get('level') as SkillLevel) : '';
  const format = (GAME_FORMATS as readonly string[]).includes(params.get('format') ?? '') ? (params.get('format') as GameFormat) : '';
  const view = params.get('view') === 'map' ? 'map' : 'list';

  function update(key: string, value: string) {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const today = todayInManila();
  const tomorrow = addDaysToDate(today, 1);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (date) q.set('date', date);
    if (level) q.set('level', level);
    if (format) q.set('format', format);
    // Location stays out of the URL: it's private and shouldn't be shared by copying a link.
    if (geo.location) q.set('near', `${geo.location.lat.toFixed(4)},${geo.location.lng.toFixed(4)}`);
    return q.toString();
  }, [date, level, format, geo.location]);

  const { games, error, loading } = useGames(query);

  // One pin per court that has games matching the filters; the badge counts them.
  const { courts, countByCourt } = useMemo(() => {
    const byId = new Map<string, Court>();
    const counts = new Map<string, number>();
    for (const g of games ?? []) {
      byId.set(g.court.id, { ...g.court, courtCount: null, setting: null, notes: null, addedBy: null, upcomingGames: 0 });
      counts.set(g.court.id, (counts.get(g.court.id) ?? 0) + 1);
    }
    return { courts: [...byId.values()], countByCourt: counts };
  }, [games]);

  const visible = games ?? [];
  const selectedCourt = view === 'map' ? (courts.find((c) => c.id === selectedCourtId) ?? null) : null;
  const filtered = Boolean(date || level || format);
  const customDate = date && date !== today && date !== tomorrow;

  return (
    <>
      <div className="page-header">
        <h1>Games</h1>
        <div className="view-toggle" role="group" aria-label="View">
          <button className={view === 'list' ? 'is-selected' : ''} aria-pressed={view === 'list'} onClick={() => update('view', '')}>
            List
          </button>
          <button className={view === 'map' ? 'is-selected' : ''} aria-pressed={view === 'map'} onClick={() => update('view', 'map')}>
            Map
          </button>
        </div>
      </div>

      <section className="filters" aria-label="Filters">
        <div className="chips" role="group" aria-label="Day">
          <button className={!date ? 'chip is-selected' : 'chip'} aria-pressed={!date} onClick={() => update('date', '')}>
            Any day
          </button>
          <button className={date === today ? 'chip is-selected' : 'chip'} aria-pressed={date === today} onClick={() => update('date', today)}>
            Today
          </button>
          <button
            className={date === tomorrow ? 'chip is-selected' : 'chip'}
            aria-pressed={date === tomorrow}
            onClick={() => update('date', tomorrow)}
          >
            Tomorrow
          </button>
          <label className={customDate ? 'chip chip-date is-selected' : 'chip chip-date'}>
            {customDate ? shortDate.format(new Date(`${date}T00:00:00Z`)) : 'Pick date'}
            <input type="date" min={today} value={date} onChange={(e) => update('date', e.target.value)} aria-label="Pick a date" />
          </label>
        </div>

        <div className="chips" role="group" aria-label="Format">
          {(['', 'singles', 'doubles'] as const).map((f) => (
            <button key={f || 'any'} className={format === f ? 'chip is-selected' : 'chip'} aria-pressed={format === f} onClick={() => update('format', f)}>
              {f === '' ? 'Any format' : f === 'singles' ? 'Singles' : 'Doubles'}
            </button>
          ))}
        </div>

        <div className="filters-row">
          <SelectField
            label="Level"
            value={level}
            onChange={(e) => update('level', e.target.value)}
            options={[
              { value: '', label: 'Any level' },
              ...levelOptions.map((o) => ({ ...o, label: `Open to ${o.label}${user?.skillLevel === o.value ? ' (you)' : ''}` })),
            ]}
          />
          <button className="button button-ghost button-small near-button" onClick={geo.locate} disabled={geo.locating}>
            {geo.locating ? 'Locating…' : geo.location ? '✓ Nearest first' : 'Nearest first'}
          </button>
        </div>
        {geo.error ? <p className="form-error">{geo.error}</p> : null}
      </section>

      {view === 'map' ? (
        <Suspense fallback={<div className="map map-placeholder">Loading map…</div>}>
          <CourtMap
            courts={courts}
            selectedId={selectedCourtId}
            onSelect={setSelectedCourtId}
            userLocation={geo.location}
            onLocate={geo.locate}
            locating={geo.locating}
            countFor={(c) => countByCourt.get(c.id) ?? 0}
            sheetOffset={selectedCourt ? SHEET_OFFSET : 0}
          />
          {selectedCourt ? (
            <CourtSheet
              court={selectedCourt}
              onClose={() => setSelectedCourtId(null)}
              distanceKm={geo.location ? distanceKm(geo.location, selectedCourt) : null}
              games={visible.filter((g) => g.court.id === selectedCourt.id)}
            />
          ) : null}
        </Suspense>
      ) : null}

      {error ? (
        <p className="card">{error}</p>
      ) : games === null ? (
        <p className="muted">Loading games…</p>
      ) : visible.length === 0 ? (
        <section className="card empty-state">
          <h2>{filtered ? 'No games match these filters' : 'No upcoming games yet'}</h2>
          <p className="muted">
            {filtered ? 'Try another day or level, or ' : 'Be the first: '}
            {user ? <Link to="/games/new">post a game</Link> : <Link to="/register">sign up and post one</Link>}.
          </p>
        </section>
      ) : (
        <ul className={loading ? 'game-list is-loading' : 'game-list'} aria-busy={loading}>
          {visible.map((g) => (
            <li key={g.id}>
              <GameCard game={g} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
