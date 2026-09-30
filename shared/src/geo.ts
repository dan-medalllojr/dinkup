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
