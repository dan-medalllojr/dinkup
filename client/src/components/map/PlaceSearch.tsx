import { useState } from 'react';
import { useMap } from 'react-leaflet';
import type { Place } from '@dinkup/shared';
import { api, ApiError } from '../../lib/api.ts';
import { MapOverlay } from './MapOverlay.tsx';

// Search runs on Enter, not while typing: Nominatim's usage policy doesn't
// allow autocomplete. Picking a result flies the map there.
//
// Not a <form>: the map can sit inside another form (Post a game), and nested
// forms are invalid; Enter here must never submit the outer form.
export function PlaceSearch({ onPick }: { onPick?: (place: Place) => void }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search() {
    if (query.trim().length < 3) return setError('Type at least 3 characters');
    setBusy(true);
    setError('');
    try {
      const res = await api<{ places: Place[] }>('GET', `/geo/search?q=${encodeURIComponent(query.trim())}`);
      setResults(res.places);
      if (res.places.length === 0) setError('No places found in Cebu. Try another name, or tap the map.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  function pick(place: Place) {
    map.flyTo([place.lat, place.lng], 17, { duration: 0.6 });
    setResults(null);
    setQuery(place.label);
    onPick?.(place);
  }

  return (
    <MapOverlay className="map-search">
      <div className="map-search-box" role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search a place in Cebu"
          aria-label="Search a place"
          enterKeyHint="search"
        />
        <button type="button" onClick={() => void search()} disabled={busy} aria-label="Search">
          {busy ? '…' : '⌕'}
        </button>
      </div>
      {error ? <p className="map-search-msg">{error}</p> : null}
      {results && results.length > 0 ? (
        <ul className="map-search-results">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button type="button" onClick={() => pick(p)}>
                <strong>{p.label}</strong>
                <span>{[p.address, p.city].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </MapOverlay>
  );
}
