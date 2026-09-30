import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { CEBU_CENTER, directionsUrl, type Court, type LatLng } from '@dinkup/shared';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker loads its PNGs from paths that break under Vite's
// bundling, so pins are drawn with CSS instead (see .map-pin in styles.css).
const courtIcon = (active: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin${active ? ' map-pin-active' : ''}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });

const userIcon = L.divIcon({ className: '', html: '<span class="map-user"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

// On first load: jump straight to a preselected court, otherwise zoom to show
// every court (a fixed center can leave pins, e.g. Lapu-Lapu, off-screen).
function InitialView({ courts, selected }: { courts: Court[]; selected: Court | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || courts.length === 0) return;
    done.current = true;
    if (selected) map.setView([selected.lat, selected.lng], 15, { animate: false });
    else map.fitBounds(L.latLngBounds(courts.map((c) => [c.lat, c.lng])), { padding: [32, 32], maxZoom: 14 });
  }, [map, courts, selected]);
  return null;
}

// Depends on the court's id and coordinates, not the object, so re-renders
// don't re-fly. Leaflet's flyTo produces NaN coordinates (and crashes) if
// it's started while a previous fly animation is still running, so stop
// any animation first and skip if we're already there.
function FlyTo({ target }: { target: Court | null }) {
  const map = useMap();
  const id = target?.id;
  const lat = target?.lat;
  const lng = target?.lng;
  useEffect(() => {
    if (id === undefined || lat === undefined || lng === undefined) return;
    map.stop();
    const zoom = Math.max(Math.round(map.getZoom()), 15);
    if (map.getCenter().distanceTo([lat, lng]) < 5 && map.getZoom() === zoom) return;
    map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }, [map, id, lat, lng]);
  return null;
}

type Props = {
  courts: Court[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation: LatLng | null;
};

export function CourtMap({ courts, selectedId, onSelect, userLocation }: Props) {
  const selected = courts.find((c) => c.id === selectedId) ?? null;

  return (
    <MapContainer center={[CEBU_CENTER.lat, CEBU_CENTER.lng]} zoom={12} className="map" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {courts.map((court) => (
        <Marker
          key={court.id}
          position={[court.lat, court.lng]}
          icon={courtIcon(court.id === selectedId)}
          eventHandlers={{ click: () => onSelect(court.id) }}
        >
          <Popup>
            <strong>{court.name}</strong>
            <br />
            {court.city}
            <br />
            <a href={directionsUrl(court)} target="_blank" rel="noreferrer">
              Directions
            </a>
          </Popup>
        </Marker>
      ))}
      {userLocation ? <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} /> : null}
      <InitialView courts={courts} selected={selected} />
      <FlyTo target={selected} />
    </MapContainer>
  );
}
