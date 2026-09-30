import { CEBU_BOUNDS, type Place } from '@dinkup/shared';

// A thin proxy to OpenStreetMap's Nominatim geocoder. Going through the server
// (instead of every phone calling Nominatim directly) lets us follow its usage
// policy: a real User-Agent, at most one request per second, and caching.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Dinkup/1.0 (+https://dinkup.onrender.com)';
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

type Fetch = typeof fetch;
let fetchImpl: Fetch = fetch;
/** Tests swap in a fake so they never call the real service. */
export function setGeocodeFetch(f: Fetch) {
  fetchImpl = f;
  cache.clear();
  nextSlot = 0;
}

const cache = new Map<string, { value: unknown; expires: number }>();
let nextSlot = 0;

// Every outgoing request waits for its own 1.1s slot, across all users.
async function throttled(url: string): Promise<unknown> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

type NominatimAddress = Partial<Record<'house_number' | 'road' | 'neighbourhood' | 'suburb' | 'village' | 'quarter' | 'city' | 'town' | 'municipality' | 'county', string>>;
type NominatimResult = { lat: string; lon: string; name?: string; display_name: string; address?: NominatimAddress };

function toPlace(r: NominatimResult): Place {
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const area = a.suburb ?? a.village ?? a.quarter ?? a.neighbourhood ?? '';
  const city = a.city ?? a.town ?? a.municipality ?? a.county ?? '';
  return {
    label: r.name || street || r.display_name.split(',')[0]!,
    address: [street, area].filter(Boolean).join(', '),
    city,
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().toLowerCase();
  return cached(`s:${q}`, async () => {
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      countrycodes: 'ph',
      // Prefer (and limit to) the Cebu area.
      viewbox: `${CEBU_BOUNDS.west},${CEBU_BOUNDS.north},${CEBU_BOUNDS.east},${CEBU_BOUNDS.south}`,
      bounded: '1',
    });
    const results = (await throttled(`${NOMINATIM}/search?${params}`)) as NominatimResult[];
    return results.map(toPlace);
  });
}

export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  // ~11 m grid, so nearby taps share a cache entry.
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  return cached(key, async () => {
    const params = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), format: 'jsonv2', addressdetails: '1', zoom: '18' });
    const result = (await throttled(`${NOMINATIM}/reverse?${params}`)) as NominatimResult & { error?: string };
    return result.error ? null : { ...toPlace(result), lat, lng };
  });
}
