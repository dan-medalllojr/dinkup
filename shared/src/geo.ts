export type LatLng = { lat: number; lng: number };

// Default map view: Metro Cebu (Cebu City, Mandaue, Lapu-Lapu, Talisay).
export const CEBU_CENTER: LatLng = { lat: 10.315, lng: 123.905 };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Great-circle distance. At Metro Cebu scale a few dozen rows is nothing,
// so this runs in JS instead of needing PostGIS.
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function directionsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// Where courts can be added: Cebu island plus Mactan, Bantayan, and Camotes.
export const CEBU_BOUNDS = { south: 9.3, west: 123.2, north: 11.4, east: 124.5 } as const;

export function inCebu({ lat, lng }: LatLng): boolean {
  return lat >= CEBU_BOUNDS.south && lat <= CEBU_BOUNDS.north && lng >= CEBU_BOUNDS.west && lng <= CEBU_BOUNDS.east;
}

// Closer than this to an existing court is treated as the same place.
export const DUPLICATE_COURT_METERS = 50;
// Closer than this, the app asks "is this the same place?" before adding.
export const NEARBY_COURT_METERS = 150;
export const MAX_COURTS_ADDED_PER_DAY = 5;

/** A search or reverse-geocoding result (via the server's Nominatim proxy). */
export type Place = { label: string; address: string; city: string; lat: number; lng: number };
