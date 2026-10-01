import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { distanceKm, type Court } from '@dinkup/shared';
import { AddCourtPanel } from '../components/AddCourtPanel.tsx';
import { CourtMap } from '../components/CourtMap.tsx';
import { CourtSheet, SHEET_OFFSET } from '../components/CourtSheet.tsx';
import { RadiusPicker } from '../components/RadiusPicker.tsx';
import { formatKm } from '../components/GameCard.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { useAddCourt } from '../lib/useAddCourt.ts';
import { useGeolocation } from '../lib/useGeolocation.ts';
import { useNearRadius } from '../lib/useNearRadius.ts';
import { useReconnect } from '../lib/useReconnect.ts';

const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', covered: 'Covered' } as const;

function describe(court: Court) {
  const parts = [];
  if (court.courtCount) parts.push(`${court.courtCount} court${court.courtCount === 1 ? '' : 's'}`);
  if (court.setting) parts.push(SETTING_LABELS[court.setting]);
  if (court.upcomingGames) parts.push(`${court.upcomingGames} upcoming game${court.upcomingGames === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function CourtsPage() {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [error, setError] = useState('');
  // ?court=<id> opens that court's sheet (Home's "Courts near you" links here),
  // and the URL follows the selection so a court can be linked to.
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('court'));
  useEffect(() => {
    if ((params.get('court') ?? null) !== selectedId) setParams(selectedId ? { court: selectedId } : {}, { replace: true });
  }, [selectedId, params, setParams]);
  const geo = useGeolocation();
  const [radius, setRadius] = useNearRadius();
  const reconnect = useReconnect();
  const add = useAddCourt(courts ?? [], (court) => {
    setCourts((c) => [...(c ?? []), court].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedId(court.id);
  });

  useEffect(() => {
    setError('');
    api<{ courts: Court[] }>('GET', '/courts')
      .then((res) => setCourts(res.courts))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, [reconnect]);

  // Nearest first once we know where the user is; alphabetical otherwise.
  const sorted = useMemo(() => {
    if (!courts) return [];
    const withDistance = courts.map((c) => ({ court: c, km: geo.location ? distanceKm(geo.location, c) : null }));
    if (geo.location) withDistance.sort((a, b) => a.km! - b.km!);
    return withDistance;
  }, [courts, geo.location]);

  // With a location: courts in range first, then everything farther away.
  const inRange = geo.location ? sorted.filter((c) => c.km! <= radius) : sorted;
  const farther = geo.location ? sorted.filter((c) => c.km! > radius) : [];
  const focus = useMemo(() => (geo.location ? { center: geo.location, radiusKm: radius } : null), [geo.location, radius]);

  if (error) return <p className="card">{error}</p>;

  // One row of the list (the list is split into "in range" and "farther").
  const renderCourt = ({ court, km }: { court: Court; km: number | null }) => (
    <li key={court.id} className={`card court-item${court.id === selectedId ? ' court-item-active' : ''}`}>
      <button className="court-item-main" onClick={() => setSelectedId(court.id)}>
        <span className="court-name">{court.name}</span>
        <span className="muted small">{[court.address, court.city].filter(Boolean).join(', ')}</span>
        {describe(court) ? <span className="muted small">{describe(court)}</span> : null}
        {court.addedBy ? <span className="badge badge-demo court-added">Added by a player</span> : null}
      </button>
      <div className="court-item-side">
        {km !== null ? <span className="distance">{formatKm(km)}</span> : null}
        {court.upcomingGames ? <span className="badge badge-open">{court.upcomingGames} games</span> : null}
      </div>
    </li>
  );

  const selected = courts?.find((c) => c.id === selectedId) ?? null;
  const canAdd = user && !user.isDemo;

  return (
    <>
      <div className="page-header">
        <h1>Courts in Cebu</h1>
        {!add.active ? (
          canAdd ? (
            <button className="button button-ghost button-small" onClick={() => { setSelectedId(null); add.start(); }}>
              + Add a court
            </button>
          ) : user ? null : (
            <Link to="/login" className="small">
              Log in to add a court
            </Link>
          )
        ) : null}
      </div>

      <CourtMap
        courts={courts ?? []}
        selectedId={add.active ? null : selectedId}
        onSelect={setSelectedId}
        userLocation={geo.location}
        focus={add.active ? null : focus}
        onLocate={geo.locate}
        locating={geo.locating}
        search
        onPlacePicked={add.active ? add.pickPlace : undefined}
        draftPin={add.active ? add.pin : undefined}
        onDraftMove={add.setPin}
        sheetOffset={selected ? SHEET_OFFSET : 0}
      />
      {geo.error ? <p className="form-error">{geo.error}</p> : null}
      {geo.location && !add.active ? (
        <RadiusPicker value={radius} onChange={setRadius} />
      ) : !geo.location && !geo.checking && !add.active ? (
        <button className="button button-ghost button-small near-me" onClick={geo.locate} disabled={geo.locating}>
          {geo.locating ? 'Locating…' : 'Show courts near me'}
        </button>
      ) : null}

      {add.active ? (
        <section className="card">
          <h2>Add a court</h2>
          <AddCourtPanel
            add={add}
            onUseExisting={(court) => {
              add.cancel();
              setSelectedId(court.id);
            }}
          />
        </section>
      ) : null}

      {courts === null ? (
        <p className="muted">Loading courts…</p>
      ) : (
        <>
          {geo.location ? (
            <h2 className="court-group">
              {inRange.length > 0 ? `Within ${radius} km · ${inRange.length} ${inRange.length === 1 ? 'court' : 'courts'}` : `No courts within ${radius} km`}
            </h2>
          ) : null}
          <ul className="court-list">{inRange.map(renderCourt)}</ul>
          {farther.length > 0 ? (
            <>
              <h2 className="court-group">Farther away</h2>
              <ul className="court-list">{farther.map(renderCourt)}</ul>
            </>
          ) : null}
        </>
      )}

      {selected && !add.active ? (
        <CourtSheet court={selected} onClose={() => setSelectedId(null)} distanceKm={geo.location ? distanceKm(geo.location, selected) : null} />
      ) : null}
    </>
  );
}
