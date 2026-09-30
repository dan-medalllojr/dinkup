import { CEBU_BOUNDS, isGoogleMapsHost, isShortMapsLink, parseGoogleMapsUrl, type PastedLocation, type Place } from '@dinkup/shared';

// Place lookups, proxied through the server so every phone doesn't hit the
// free public services directly. The server sends a real User-Agent, spaces
// requests out, and caches answers.
//
// - Search (as you type): Photon, an OpenStreetMap geocoder built for
//   autocomplete. https://photon.komoot.io (public instance, fair use)
// - Address for a dropped pin: Nominatim, whose policy allows at most one
//   request per second and no autocomplete.
//   https://operations.osmfoundation.org/policies/nominatim/
const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Dinkup/1.0 (+https://dinkup.onrender.com)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

type Fetch = typeof fetch;
let fetchImpl: Fetch = fetch;
/** Tests swap in a fake so they never call the real service. */
export function setGeocodeFetch(f: Fetch) {
  fetchImpl = f;
  cache.clear();
  nominatim.reset();
  photon.reset();
}

const cache = new Map<string, { value: unknown; expires: number }>();

// Each provider gets its own queue: every request waits for its slot.
function makeThrottle(minIntervalMs: number) {
  let nextSlot = 0;
  return {
    reset: () => (nextSlot = 0),
    async fetchJson(url: string): Promise<unknown> {
      const now = Date.now();
      const wait = Math.max(0, nextSlot - now);
      nextSlot = Math.max(now, nextSlot) + minIntervalMs;
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
      return res.json();
    },
  };
}
const nominatim = makeThrottle(1100); // policy: max 1 request/second
const photon = makeThrottle(200); // shared public instance: stay gentle

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

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Partial<Record<'name' | 'street' | 'housenumber' | 'district' | 'locality' | 'city' | 'county' | 'state', string>>;
};

// Photon labels Cebu places "Central Visayas" (or "Cebu"); Bohol and Negros
// places, which the Cebu rectangle also overlaps, carry their own province.
const CEBU_STATES = new Set(['Central Visayas', 'Cebu']);

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().toLowerCase();
  return cached(`s:${q}`, async () => {
    const params = new URLSearchParams({
      q,
      limit: '10',
      lang: 'en',
      bbox: `${CEBU_BOUNDS.west},${CEBU_BOUNDS.south},${CEBU_BOUNDS.east},${CEBU_BOUNDS.north}`,
    });
    const data = (await photon.fetchJson(`${PHOTON}/api/?${params}`)) as { features: PhotonFeature[] };
    const places: Place[] = [];
    for (const f of data.features) {
      const p = f.properties;
      if (p.state && !CEBU_STATES.has(p.state)) continue;
      const [lng, lat] = f.geometry.coordinates;
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const label = p.name || street;
      if (!label) continue;
      // Photon often returns one place several times (the mall, its lot, its
      // shop entry); keep the first within 150 m of the same name.
      if (places.some((x) => x.label === label && Math.abs(x.lat - lat) < 0.0015 && Math.abs(x.lng - lng) < 0.0015)) continue;
      places.push({ label, address: [street !== label ? street : '', p.district ?? p.locality ?? ''].filter(Boolean).join(', '), city: p.city ?? p.county ?? '', lat, lng });
      if (places.length === 6) break;
    }
    return places;
  });
}

export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  // ~11 m grid, so nearby taps share a cache entry.
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  return cached(key, async () => {
    const params = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), format: 'jsonv2', addressdetails: '1', zoom: '18' });
    const result = (await nominatim.fetchJson(`${NOMINATIM}/reverse?${params}`)) as NominatimResult & { error?: string };
    return result.error ? null : { ...toPlace(result), lat, lng };
  });
}

export class LinkError extends Error {}

/**
 * Location from a pasted Google Maps link. Full links are parsed directly;
 * short links (maps.app.goo.gl/…) are followed, one redirect at a time and
 * only while every hop stays on Google Maps domains, so this can't be used
 * to make the server fetch arbitrary URLs (SSRF).
 */
export async function resolveMapsLink(raw: string): Promise<PastedLocation> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LinkError("That doesn't look like a link");
  }
  if (url.protocol !== 'https:' || !isGoogleMapsHost(url.hostname)) throw new LinkError('Paste a Google Maps link (google.com/maps or maps.app.goo.gl)');

  return cached(`l:${url.href}`, async () => {
    for (let hops = 0; isShortMapsLink(url) && hops < 5; hops++) {
      const res = await fetchImpl(url.href, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
      const location = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !location) throw new LinkError("Couldn't open that short link");
      const next = new URL(location, url);
      if (next.protocol !== 'https:' || !isGoogleMapsHost(next.hostname)) throw new LinkError('That link points outside Google Maps');
      url = next;
    }
    const found = parseGoogleMapsUrl(url.href);
    if (!found) throw new LinkError("Couldn't find a location in that link. Open the place in Google Maps and share it again, or paste its coordinates.");
    return found;
  });
}
