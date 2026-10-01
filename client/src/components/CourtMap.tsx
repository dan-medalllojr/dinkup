import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import { CEBU_CENTER, type Court, type LatLng } from '@dinkup/shared';
import { useColorScheme } from '../lib/useColorScheme.ts';
import { PlaceSearch, type PickedPlace } from './map/PlaceSearch.tsx';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre parses tiles in a Web Worker it loads from a file next to its own
// code. Bundlers break that path (Vite's dev pre-bundling moves the file, and
// the production build doesn't emit it at all), so bundle the worker ourselves
// and point MapLibre at it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

// MapLibre GL (the engine, in the browser) + OpenFreeMap (free vector tiles
// and styles: no API key, no request limits). Liberty looks close to Google
// Maps. For dark mode, Fiord: OpenFreeMap's "Dark" style renders land and sea
// both near-black, which hides the coastline on an island map. Both are open
// source, so if OpenFreeMap ever went away the same styles could be
// self-hosted by changing these URLs.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
};

type Props = {
  courts: Court[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLocation?: LatLng | null;
  onLocate?: () => void;
  locating?: boolean;
  /** Badge number per court; defaults to its upcoming games. */
  countFor?: (court: Court) => number;
  /** Add-a-court mode: taps drop this draggable pin instead of selecting. */
  draftPin?: LatLng | null;
  onDraftMove?: (p: LatLng) => void;
  search?: boolean;
  onPlacePicked?: (place: PickedPlace) => void;
  /** Pixels to keep free at the bottom (e.g. under a bottom sheet). */
  sheetOffset?: number;
};

function pinElement(label: string) {
  // MapLibre positions the outer element with a transform, so styling (and
  // the selected "grow" transform) lives on the inner span.
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-marker';
  el.setAttribute('aria-label', label);
  el.innerHTML = '<span class="map-pin"><span class="map-pin-dot"></span></span>';
  return el;
}

function updatePin(el: HTMLElement, count: number, selected: boolean, userAdded: boolean) {
  const pin = el.firstElementChild as HTMLElement;
  pin.className = ['map-pin', selected && 'is-selected', userAdded && 'is-user-added'].filter(Boolean).join(' ');
  const badge = count > 0 ? `<span class="map-pin-badge">${count > 9 ? '9+' : count}</span>` : '';
  pin.innerHTML = `<span class="map-pin-dot"></span>${badge}`;
  el.style.zIndex = selected ? '2' : '1';
}

export function CourtMap({
  courts,
  selectedId,
  onSelect,
  userLocation = null,
  onLocate,
  locating = false,
  countFor = (c) => c.upcomingGames,
  draftPin,
  onDraftMove,
  search = false,
  onPlacePicked,
  sheetOffset = 0,
}: Props) {
  const scheme = useColorScheme();
  const container = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [failed, setFailed] = useState(false);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const addMode = draftPin !== undefined;

  // Event handlers read the latest props through a ref, so the map and its
  // markers don't have to be rebuilt every render.
  const latest = useRef({ onSelect, onDraftMove, addMode, courts });
  latest.current = { onSelect, onDraftMove, addMode, courts };

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    let m: MLMap;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: STYLES[scheme],
        center: [CEBU_CENTER.lng, CEBU_CENTER.lat],
        zoom: 11,
        // Page-embedded map: no scroll-wheel zoom trap, no rotation or tilt.
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true); // no WebGL
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.on('click', (e) => {
      // Clicks on pins bubble up here too; those are handled by the pin.
      if ((e.originalEvent.target as HTMLElement).closest('.map-marker')) return;
      if (latest.current.addMode) latest.current.onDraftMove?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      else latest.current.onSelect(null);
    });
    mapRef.current = m;
    setMap(m);
    return () => {
      m.remove();
      mapRef.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- style switches are handled below
  }, []);

  // Follow the device's light/dark setting.
  const shownScheme = useRef(scheme);
  useEffect(() => {
    if (!map || shownScheme.current === scheme) return;
    shownScheme.current = scheme;
    map.setStyle(STYLES[scheme]);
  }, [map, scheme]);

  // Court pins: add, update, and remove to match the props.
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    for (const court of courts) {
      seen.add(court.id);
      let entry = markers.current.get(court.id);
      if (!entry) {
        const el = pinElement(court.name);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const c = latest.current.courts.find((x) => x.id === court.id);
          if (c) pickCourt(c);
        });
        entry = { el, marker: new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([court.lng, court.lat]).addTo(map) };
        markers.current.set(court.id, entry);
      } else {
        entry.marker.setLngLat([court.lng, court.lat]);
      }
      updatePin(entry.el, countFor(court), court.id === selectedId && !addMode, court.addedBy !== null);
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
  }, [map, courts, selectedId, countFor, addMode]);

  // First view: jump to a preselected court, otherwise fit every court.
  const fitted = useRef(false);
  useEffect(() => {
    if (!map || fitted.current || courts.length === 0) return;
    fitted.current = true;
    const selected = courts.find((c) => c.id === selectedId);
    if (selected) {
      map.jumpTo({ center: [selected.lng, selected.lat], zoom: 15 });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      for (const c of courts) bounds.extend([c.lng, c.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
    }
  }, [map, courts, selectedId]);

  // Fly to a newly selected court, keeping it above the bottom sheet. The
  // nudge scales with the map's height so short maps (small phones) don't
  // push the pin under the search box.
  const selected = courts.find((c) => c.id === selectedId) ?? null;
  const flownTo = useRef('');
  useEffect(() => {
    if (!map || !selected || addMode) return;
    const key = `${selected.id}@${selected.lat},${selected.lng}`;
    if (flownTo.current === key) return; // StrictMode re-runs, re-renders
    flownTo.current = key;
    const dy = Math.min(sheetOffset / 2, map.getContainer().clientHeight * 0.15);
    // A bottom sheet is about to cover the lower part of the screen: bring the
    // map to the top of the viewport so the selected pin stays visible above it
    // (on the Games page the map sits below the filters).
    const wrapTop = wrap.current?.getBoundingClientRect().top ?? 0;
    // Scroll unless the map is already at the top (just under the header),
    // whether it's currently below (Games filters) or above (scrolled list).
    if (sheetOffset > 0 && wrap.current && (wrapTop > 80 || wrapTop < 50)) {
      wrap.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    map.stop();
    map.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(Math.round(map.getZoom()), 15), offset: [0, -dy], duration: 700 });
  }, [map, selected, addMode, sheetOffset]);
  useEffect(() => {
    if (!selectedId) flownTo.current = '';
  }, [selectedId]);

  // The player's location dot.
  const userMarker = useRef<Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!userLocation) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const el = document.createElement('span');
      el.className = 'map-user';
      userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    } else userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
  }, [map, userLocation]);

  // Center on the player once their location arrives after pressing the button.
  const locateRequested = useRef(false);
  useEffect(() => {
    if (map && userLocation && locateRequested.current) {
      locateRequested.current = false;
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
    }
  }, [map, userLocation]);

  // Add-a-court draft pin (orange, draggable).
  const draftMarker = useRef<Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!draftPin) {
      draftMarker.current?.remove();
      draftMarker.current = null;
      return;
    }
    if (!draftMarker.current) {
      const el = document.createElement('span');
      el.className = 'map-marker';
      el.innerHTML = '<span class="map-pin is-draft"><span class="map-pin-dot"></span></span>';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true }).setLngLat([draftPin.lng, draftPin.lat]).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        latest.current.onDraftMove?.({ lat: p.lat, lng: p.lng });
      });
      draftMarker.current = marker;
    } else draftMarker.current.setLngLat([draftPin.lng, draftPin.lat]);
  }, [map, draftPin]);

  // Tapping a pin and choosing a court in search do the same thing. While
  // adding a court, it means "here": the draft pin moves there, which brings
  // up "Is it one of these?".
  function pickCourt(c: Court) {
    if (latest.current.addMode) latest.current.onDraftMove?.({ lat: c.lat, lng: c.lng });
    else latest.current.onSelect(c.id);
  }

  function searchPickCourt(c: Court) {
    // Out of add mode, selecting flies there (see above); in it, fly ourselves.
    if (latest.current.addMode) map?.flyTo({ center: [c.lng, c.lat], zoom: 17, duration: 700 });
    pickCourt(c);
  }

  function pickPlace(place: PickedPlace) {
    map?.flyTo({ center: [place.lng, place.lat], zoom: 17, duration: 700 });
    onPlacePicked?.(place);
  }

  function locate() {
    locateRequested.current = true;
    if (userLocation && map) map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
    else onLocate?.();
  }

  if (failed) {
    return <p className="card muted">This device can't show the map (WebGL is unavailable). The list below still works.</p>;
  }

  return (
    <div ref={wrap} className={addMode ? 'map-wrap is-adding' : 'map-wrap'}>
      <div ref={container} className="map" />
      {search ? <PlaceSearch courts={courts} onPick={pickPlace} onPickCourt={searchPickCourt} /> : null}
      {onLocate ? (
        <div className="map-overlay map-locate">
          <button type="button" aria-label="Show my location" title="Show my location" className={locating ? 'is-busy' : undefined} onClick={locate}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className="map-overlay map-zoom">
        <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()}>
          −
        </button>
      </div>
    </div>
  );
}
