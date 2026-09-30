import { useEffect, useMemo, useState } from 'react';
import { directionsUrl, distanceKm, type Court } from '@dinkup/shared';
import { CourtMap } from '../components/CourtMap.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useGeolocation } from '../lib/useGeolocation.ts';

const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', covered: 'Covered' } as const;

function describe(court: Court) {
  const parts = [];
  if (court.courtCount) parts.push(`${court.courtCount} court${court.courtCount === 1 ? '' : 's'}`);
  if (court.setting) parts.push(SETTING_LABELS[court.setting]);
  return parts.join(' · ');
}

export function CourtsPage() {
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const geo = useGeolocation();

  useEffect(() => {
    api<{ courts: Court[] }>('GET', '/courts')
      .then((res) => setCourts(res.courts))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
  }, []);

  // Nearest first once we know where the user is; alphabetical otherwise.
  const sorted = useMemo(() => {
    if (!courts) return [];
    const withDistance = courts.map((c) => ({ court: c, km: geo.location ? distanceKm(geo.location, c) : null }));
    if (geo.location) withDistance.sort((a, b) => a.km! - b.km!);
    return withDistance;
  }, [courts, geo.location]);

  function select(id: string) {
    setSelectedId(id);
    document.getElementById(`court-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (error) return <p className="card">{error}</p>;

  return (
    <>
      <div className="page-header">
        <h1>Courts in Cebu</h1>
        <button className="button button-ghost button-small" onClick={geo.locate} disabled={geo.locating}>
          {geo.locating ? 'Locating…' : geo.location ? 'Update location' : 'Sort by distance'}
        </button>
      </div>
      {geo.error ? <p className="form-error">{geo.error}</p> : null}

      <CourtMap courts={courts ?? []} selectedId={selectedId} onSelect={select} userLocation={geo.location} />

      {courts === null ? (
        <p className="muted">Loading courts…</p>
      ) : courts.length === 0 ? (
        <p className="card muted">No courts yet.</p>
      ) : (
        <ul className="court-list">
          {sorted.map(({ court, km }) => (
            <li
              key={court.id}
              id={`court-${court.id}`}
              className={`card court-item${court.id === selectedId ? ' court-item-active' : ''}`}
            >
              <button className="court-item-main" onClick={() => setSelectedId(court.id)}>
                <span className="court-name">{court.name}</span>
                <span className="muted small">
                  {[court.address, court.city].filter(Boolean).join(', ')}
                </span>
                {describe(court) ? <span className="muted small">{describe(court)}</span> : null}
              </button>
              <div className="court-item-side">
                {km !== null ? <span className="distance">{km < 10 ? km.toFixed(1) : Math.round(km)} km</span> : null}
                <a href={directionsUrl(court)} target="_blank" rel="noreferrer" className="small">
                  Directions
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
