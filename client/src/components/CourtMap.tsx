import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { CEBU_CENTER, type Court, type LatLng, type Place } from '@dinkup/shared';
import { useColorScheme } from '../lib/useColorScheme.ts';
import { MapOverlay } from './map/MapOverlay.tsx';
import { PlaceSearch } from './map/PlaceSearch.tsx';
import 'leaflet/dist/leaflet.css';

// OpenStreetMap's standard tiles (no API key). CARTO's "cleaner" basemaps now
// require a key and return an "API KEY REQUIRED" placeholder for every tile,
// so the calmer look comes from a CSS filter instead (see .tiles-light/.tiles-dark):
// muted colors in light mode, and an inverted night map in dark mode.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Pins are HTML (divIcon): Leaflet's default PNG markers break under Vite's
// bundling, and HTML lets us draw the game-count badge.
function pinIcon(count: number, selected: boolean, userAdded: boolean) {
  const classes = ['map-pin', selected && 'is-selected', userAdded && 'is-user-added'].filter(Boolean).join(' ');
  const badge = count > 0 ? `<span class="map-pin-badge">${count > 9 ? '9+' : count}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<span class="${classes}"><span class="map-pin-dot"></span>${badge}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

const userIcon = L.divIcon({ className: '', html: '<span class="map-user"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
const draftIcon = L.divIcon({ className: '', html: '<span class="map-pin is-draft"><span class="map-pin-dot"></span></span>', iconSize: [40, 40], iconAnchor: [20, 40] });

// On first load: jump straight to a preselected court, otherwise zoom to show
// every court (a fixed center can leave pins, e.g. Lapu-Lapu, off-screen).
function InitialView({ courts, selected }: { courts: Court[]; selected: Court | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || courts.length === 0) return;
    done.current = true;
    if (selected) map.setView([selected.lat, selected.lng], 15, { animate: false });
    else map.fitBounds(L.latLngBounds(courts.map((c) => [c.lat, c.lng])), { padding: [40, 40], maxZoom: 14 });
  }, [map, courts, selected]);
  return null;
}

// Depends on the court's id and coordinates, not the object, so re-renders
// don't re-fly. Leaflet's flyTo produces NaN coordinates (and crashes) if
// it's started while a previous fly animation is still running, so stop
// any animation first and skip if we're already there.
function FlyTo({ target, offsetY }: { target: LatLng & { id?: string } | null; offsetY: number }) {
  const map = useMap();
  const lat = target?.lat;
  const lng = target?.lng;
  const id = target?.id;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.stop();
    const zoom = Math.max(Math.round(map.getZoom()), 15);
    // Shift the view down so the pin sits above the bottom sheet, not under it.
    // Scaled to the map's height so short maps (small phones) don't push the
    // pin up under the search box.
    const dy = Math.min(offsetY, map.getSize().y * 0.15);
    const point = map.project([lat, lng], zoom).add([0, dy]);
    const dest = map.unproject(point, zoom);
    if (map.getCenter().distanceTo(dest) < 5 && map.getZoom() === zoom) return;
    map.flyTo(dest, zoom, { duration: 0.6 });
  }, [map, id, lat, lng, offsetY]);
  return null;
}

function ClickHandler({ onMapClick, onBackground }: { onMapClick?: (p: LatLng) => void; onBackground: () => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      else onBackground();
    },
  });
  return null;
}

function LocateButton({ onLocate, locating, location }: { onLocate: () => void; locating: boolean; location: LatLng | null }) {
  const map = useMap();
  // Center on the player once their location arrives after pressing the button.
  const requested = useRef(false);
  useEffect(() => {
    if (location && requested.current) {
      requested.current = false;
      map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [map, location]);
  return (
    <MapOverlay className="map-locate">
      <button
        type="button"
        aria-label="Show my location"
        title="Show my location"
        className={locating ? 'is-busy' : undefined}
        onClick={() => {
          requested.current = true;
          if (location) map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
          else onLocate();
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </MapOverlay>
  );
}

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
  onPlacePicked?: (place: Place) => void;
  /** Pixels to keep free at the bottom (e.g. under a bottom sheet). */
  sheetOffset?: number;
};

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
  const selected = courts.find((c) => c.id === selectedId) ?? null;
  const addMode = draftPin !== undefined;
  const flyTarget = useMemo(
    () => (addMode ? (draftPin ?? null) : selected && { id: selected.id, lat: selected.lat, lng: selected.lng }),
    [addMode, draftPin, selected],
  );

  return (
    <div className={addMode ? 'map-wrap is-adding' : 'map-wrap'}>
      <MapContainer center={[CEBU_CENTER.lat, CEBU_CENTER.lng]} zoom={12} className="map" scrollWheelZoom={false} zoomControl={false}>
        {/* key: re-create the layer so the theme's filter class applies */}
        <TileLayer key={scheme} url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} className={`tiles-${scheme}`} />
        {courts.map((court) => (
          <Marker
            key={court.id}
            position={[court.lat, court.lng]}
            icon={pinIcon(countFor(court), court.id === selectedId, court.addedBy !== null)}
            title={court.name}
            alt={court.name}
            keyboard
            // While adding a court, tapping an existing pin means "here": it
            // moves the draft pin there, which brings up "Is it one of these?".
            eventHandlers={{ click: () => (addMode ? onDraftMove?.({ lat: court.lat, lng: court.lng }) : onSelect(court.id)) }}
          />
        ))}
        {userLocation ? <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} interactive={false} /> : null}
        {draftPin ? (
          <Marker
            position={[draftPin.lat, draftPin.lng]}
            icon={draftIcon}
            draggable
            autoPan
            eventHandlers={{ dragend: (e) => onDraftMove?.((e.target as L.Marker).getLatLng()) }}
          />
        ) : null}
        <ClickHandler onMapClick={addMode ? onDraftMove : undefined} onBackground={() => onSelect(null)} />
        <InitialView courts={courts} selected={selected} />
        <FlyTo target={flyTarget} offsetY={sheetOffset / 2} />
        <ZoomButtons />
        {onLocate ? <LocateButton onLocate={onLocate} locating={locating} location={userLocation} /> : null}
        {search ? <PlaceSearch onPick={onPlacePicked} /> : null}
      </MapContainer>
    </div>
  );
}

function ZoomButtons() {
  const map = useMap();
  return (
    <MapOverlay className="map-zoom">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        +
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        −
      </button>
    </MapOverlay>
  );
}
