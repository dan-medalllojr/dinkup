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

// Zoom to show every court once they've loaded, instead of a fixed center
// that can leave pins (e.g. Lapu-Lapu) off-screen on a phone.
function FitToCourts({ courts }: { courts: Court[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || courts.length === 0) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(courts.map((c) => [c.lat, c.lng])), { padding: [32, 32], maxZoom: 14 });
  }, [map, courts]);
  return null;
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, target]);
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
      <FitToCourts courts={courts} />
      <FlyTo target={selected} />
    </MapContainer>
  );
}
