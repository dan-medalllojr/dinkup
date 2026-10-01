import { useEffect, useId, useRef, useState } from 'react';
import {
  distanceKm,
  DUPLICATE_COURT_METERS,
  isGoogleMapsHost,
  matchCourts,
  parseCoordinates,
  type Court,
  type PastedLocation,
  type Place,
} from '@dinkup/shared';
import { api, ApiError } from '../../lib/api.ts';

export type PickedPlace = Place & { approximate?: boolean };

type Suggestion =
  | { kind: 'court'; court: Court }
  | { kind: 'place'; place: Place }
  | { kind: 'coords'; lat: number; lng: number }
  | { kind: 'link'; url: string };

const DEBOUNCE_MS = 350;

function looksLikeMapsLink(text: string) {
  try {
    const url = new URL(text.trim());
    return isGoogleMapsHost(url.hostname);
  } catch {
    return false;
  }
}

// Search as you type: Dinkup's own courts first (matched instantly in the
// browser), then places from Photon via our server. Plus two shortcuts for
// places the open data doesn't know: paste coordinates ("10.3242, 123.9268")
// or a Google Maps share link, and the map jumps there.
//
// Not a <form>: the map can sit inside another form (Post a game), and nested
// forms are invalid; Enter here must never submit the outer form.
type Props = {
  courts: Court[];
  onPick: (place: PickedPlace) => void;
  /** A Dinkup court was chosen: behave as if its pin was tapped. */
  onPickCourt: (court: Court) => void;
};

export function PlaceSearch({ courts, onPick, onPickCourt }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const picking = useRef(false);
  // Read through a ref so a courts refetch doesn't re-run the search.
  const courtsRef = useRef(courts);
  courtsRef.current = courts;

  useEffect(() => {
    const text = query.trim();
    setMessage('');
    if (picking.current) {
      picking.current = false;
      return;
    }
    const coords = parseCoordinates(text);
    if (coords) {
      setSuggestions([{ kind: 'coords', ...coords }]);
      setOpen(true);
      return;
    }
    if (looksLikeMapsLink(text)) {
      setSuggestions([{ kind: 'link', url: text }]);
      setOpen(true);
      return;
    }
    const hits = text.length >= 2 ? matchCourts(courtsRef.current, text) : [];
    const courtSuggestions: Suggestion[] = hits.map((court) => ({ kind: 'court', court }));
    setSuggestions(courtSuggestions);
    setActive(0);
    setOpen(hits.length > 0);
    if (text.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      api<{ places: Place[] }>('GET', `/geo/search?q=${encodeURIComponent(text)}`, undefined, { signal: controller.signal })
        .then((res) => {
          // A place at one of our courts (OSM knows a few) shows as the court.
          const extra: Suggestion[] = [];
          for (const place of res.places) {
            const court = courtsRef.current.find((c) => distanceKm(c, place) * 1000 < DUPLICATE_COURT_METERS);
            if (!court) extra.push({ kind: 'place', place });
            else if (!hits.includes(court) && !extra.some((s) => s.kind === 'court' && s.court === court)) extra.push({ kind: 'court', court });
          }
          setSuggestions([...courtSuggestions, ...extra]);
          setOpen(true);
          if (hits.length + extra.length === 0) setMessage('No matches in Cebu. Try another name, paste a Google Maps link, or tap the map.');
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setMessage(err instanceof ApiError ? err.message : 'Search failed');
        })
        .finally(() => !controller.signal.aborted && setBusy(false));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function choose(s: Suggestion) {
    setOpen(false);
    if (s.kind === 'court') {
      picking.current = true;
      setQuery(s.court.name);
      onPickCourt(s.court);
    } else if (s.kind === 'place') {
      picking.current = true;
      setQuery(s.place.label);
      onPick(s.place);
    } else if (s.kind === 'coords') {
      onPick({ label: '', address: '', city: '', lat: s.lat, lng: s.lng });
    } else {
      setBusy(true);
      try {
        const res = await api<{ location: PastedLocation }>('GET', `/geo/link?url=${encodeURIComponent(s.url)}`);
        const { lat, lng, name, approximate } = res.location;
        picking.current = true;
        setQuery(name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        onPick({ label: name ?? '', address: '', city: '', lat, lng, approximate });
        if (approximate) setMessage("That link only had the map's view, not a pin. Check the pin and drag it onto the court.");
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : "Couldn't read that link");
      } finally {
        setBusy(false);
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // never submit an outer form
      const s = suggestions[active];
      if (open && s) void choose(s);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="map-overlay map-search">
      <div className="map-search-box">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Search or paste a Maps link"
          aria-label="Search a place, or paste a Google Maps link or coordinates"
          enterKeyHint="search"
          autoComplete="off"
        />
        <span className="map-search-icon" aria-hidden>
          {busy ? '…' : '⌕'}
        </span>
      </div>
      {message ? <p className="map-search-msg">{message}</p> : null}
      {open && suggestions.length > 0 ? (
        <ul className="map-search-results" role="listbox" id={listId}>
          {suggestions.map((s, i) => (
            <li key={i} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'is-active' : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(s)}>
                {s.kind === 'court' ? (
                  <>
                    <strong>
                      <span className="map-search-pin" aria-hidden />
                      {s.court.name}
                    </strong>
                    <span>
                      {[s.court.city, s.court.upcomingGames > 0 ? `${s.court.upcomingGames} upcoming ${s.court.upcomingGames === 1 ? 'game' : 'games'}` : 'Court on Dinkup'].join(' · ')}
                    </span>
                  </>
                ) : s.kind === 'place' ? (
                  <>
                    <strong>{s.place.label}</strong>
                    <span>{[s.place.address, s.place.city].filter(Boolean).join(', ')}</span>
                  </>
                ) : s.kind === 'coords' ? (
                  <>
                    <strong>Go to these coordinates</strong>
                    <span>
                      {s.lat}, {s.lng}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Use the location from this Google Maps link</strong>
                    <span>{s.url.length > 48 ? `${s.url.slice(0, 48)}…` : s.url}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
