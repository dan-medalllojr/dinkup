import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { distanceKm, type Court } from '@dinkup/shared';
import { AddCourtPanel } from '../components/AddCourtPanel.tsx';
import { CourtMap } from '../components/CourtMap.tsx';
import { CourtSheet, SHEET_OFFSET } from '../components/CourtSheet.tsx';
import { formatKm } from '../components/GameCard.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { useAddCourt } from '../lib/useAddCourt.ts';
import { useGeolocation } from '../lib/useGeolocation.ts';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const geo = useGeolocation();
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

  if (error) return <p className="card">{error}</p>;

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
        onLocate={geo.locate}
        locating={geo.locating}
        search
        onPlacePicked={add.active ? add.pickPlace : undefined}
        draftPin={add.active ? add.pin : undefined}
        onDraftMove={add.setPin}
        sheetOffset={selected ? SHEET_OFFSET : 0}
      />
      {geo.error ? <p className="form-error">{geo.error}</p> : null}

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
        <ul className="court-list">
          {sorted.map(({ court, km }) => (
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
          ))}
        </ul>
      )}

      {selected && !add.active ? (
        <CourtSheet court={selected} onClose={() => setSelectedId(null)} distanceKm={geo.location ? distanceKm(geo.location, selected) : null} />
      ) : null}
    </>
  );
}
