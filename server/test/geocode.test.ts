import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCoordinates, parseGoogleMapsUrl } from '@dinkup/shared';
import { setGeocodeFetch } from '../src/lib/geocode.ts';
import { app } from './helpers.ts';

type Call = { url: URL; userAgent: string | null; redirect?: RequestRedirect; at: number };

// A fake upstream: `routes` maps a URL substring to a Response factory.
function fakeUpstream(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  setGeocodeFetch((async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, userAgent: new Headers(init?.headers).get('User-Agent'), redirect: init?.redirect, at: Date.now() });
    const hit = Object.entries(routes).find(([k]) => url.href.includes(k));
    if (!hit) throw new Error(`unexpected upstream call: ${url.href}`);
    return hit[1]();
  }) as typeof fetch);
  return calls;
}
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const redirect = (location: string) => () => new Response(null, { status: 302, headers: { Location: location } });

afterEach(() => setGeocodeFetch(fetch));

const feature = (name: string, lat: number, lng: number, props: Record<string, string> = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, city: 'Cebu City', state: 'Central Visayas', ...props },
});

describe('GET /api/geo/search (Photon)', () => {
  it('limits to Cebu, drops other provinces and duplicates, and shapes results', async () => {
    const calls = fakeUpstream({
      'photon.komoot.io': json({
        features: [
          feature('Ayala Center Cebu', 10.3181, 123.9051, { street: 'Cardinal Rosales Avenue', district: 'Luz' }),
          feature('Ayala Center Cebu', 10.3173, 123.9054), // same place, another OSM object
          feature('Loops Pickleball Court', 9.307, 123.301, { state: 'Negros Oriental', city: 'Dumaguete' }),
          feature('PUMPD Pickleball Cebu', 10.3242, 123.9268, { city: 'Mandaue' }),
        ],
      }),
    });
    const res = await request(app).get('/api/geo/search?q=ayala').expect(200);
    expect(res.body.places).toEqual([
      { label: 'Ayala Center Cebu', address: 'Cardinal Rosales Avenue, Luz', city: 'Cebu City', lat: 10.3181, lng: 123.9051 },
      { label: 'PUMPD Pickleball Cebu', address: '', city: 'Mandaue', lat: 10.3242, lng: 123.9268 },
    ]);
    expect(calls[0]!.userAgent).toMatch(/^Dinkup\//);
    expect(calls[0]!.url.searchParams.get('bbox')).toBe('123.2,9.3,124.5,11.4');
  });

  it('caches repeat searches', async () => {
    const calls = fakeUpstream({ 'photon.komoot.io': json({ features: [] }) });
    await request(app).get('/api/geo/search?q=Lahug').expect(200);
    await request(app).get('/api/geo/search?q=  LAHUG ').expect(200);
    expect(calls).toHaveLength(1);
  });

  it('rejects too-short queries and reports upstream failures clearly', async () => {
    fakeUpstream({ 'photon.komoot.io': json({}, 503) });
    await request(app).get('/api/geo/search?q=ab').expect(400);
    const res = await request(app).get('/api/geo/search?q=anything').expect(502);
    expect(res.body.error).toMatch(/drop a pin/);
  });
});

describe('GET /api/geo/reverse (Nominatim)', () => {
  const lahug = { lat: '10.3301', lon: '123.8987', name: '', display_name: 'x', address: { road: 'Gorordo Avenue', suburb: 'Lahug', city: 'Cebu City' } };

  it('returns the address at a point, keeping the exact coordinates', async () => {
    fakeUpstream({ 'nominatim.openstreetmap.org': json(lahug) });
    const res = await request(app).get('/api/geo/reverse?lat=10.33012&lng=123.89871').expect(200);
    expect(res.body.place).toMatchObject({ address: 'Gorordo Avenue, Lahug', city: 'Cebu City', lat: 10.33012, lng: 123.89871 });
  });

  it('spaces Nominatim requests at least a second apart', async () => {
    const calls = fakeUpstream({ 'nominatim.openstreetmap.org': json(lahug) });
    await Promise.all([request(app).get('/api/geo/reverse?lat=10.1&lng=123.9'), request(app).get('/api/geo/reverse?lat=10.2&lng=123.9')]);
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(1000);
  });

  it('returns null when there is nothing there', async () => {
    fakeUpstream({ 'nominatim.openstreetmap.org': json({ error: 'Unable to geocode' }) });
    expect((await request(app).get('/api/geo/reverse?lat=10.1&lng=124.3').expect(200)).body.place).toBeNull();
  });
});

describe('parsing pasted locations', () => {
  it('reads plain coordinates', () => {
    expect(parseCoordinates('10.3242, 123.9268')).toEqual({ lat: 10.3242, lng: 123.9268 });
    expect(parseCoordinates('10.3242,123.9268')).toEqual({ lat: 10.3242, lng: 123.9268 });
    expect(parseCoordinates('Mandaue')).toBeNull();
    expect(parseCoordinates('200.1, 123.9')).toBeNull();
  });

  it('prefers the place pin over the view center, and reads the place name', () => {
    const url = 'https://www.google.com/maps/place/PUMPD+Pickleball+Cebu/@10.3250,123.9200,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d10.324174!4d123.926787!16s';
    expect(parseGoogleMapsUrl(url)).toEqual({ lat: 10.324174, lng: 123.926787, name: 'PUMPD Pickleball Cebu', approximate: false });
  });

  it('reads ?q=lat,lng and falls back to the view center as approximate', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=10.3157,123.8854')).toMatchObject({ lat: 10.3157, lng: 123.8854, approximate: false });
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@10.3157,123.8854,15z')).toMatchObject({ lat: 10.3157, lng: 123.8854, approximate: true });
  });

  it('ignores non-Google hosts', () => {
    expect(parseGoogleMapsUrl('https://evil.example/maps/@10.3,123.9,15z')).toBeNull();
  });
});

describe('GET /api/geo/link', () => {
  it('parses a full Google Maps link without calling anything', async () => {
    const calls = fakeUpstream({});
    const url = encodeURIComponent('https://www.google.com/maps/place/Zions+Pickleball/@10.29,123.98,17z/data=!3d10.294865!4d123.983563');
    const res = await request(app).get(`/api/geo/link?url=${url}`).expect(200);
    expect(res.body.location).toEqual({ lat: 10.294865, lng: 123.983563, name: 'Zions Pickleball', approximate: false });
    expect(calls).toHaveLength(0);
  });

  it('follows a short link, one manual redirect at a time', async () => {
    const calls = fakeUpstream({
      'maps.app.goo.gl/abc': redirect('https://www.google.com/maps/place/Nickleball+Avenue/data=!3d10.26852!4d123.836435'),
    });
    const res = await request(app).get(`/api/geo/link?url=${encodeURIComponent('https://maps.app.goo.gl/abc')}`).expect(200);
    expect(res.body.location).toMatchObject({ lat: 10.26852, lng: 123.836435, name: 'Nickleball Avenue' });
    expect(calls.map((c) => c.redirect)).toEqual(['manual']);
  });

  it('refuses links outside Google Maps, and short links that redirect elsewhere (SSRF guard)', async () => {
    const calls = fakeUpstream({ 'maps.app.goo.gl/bad': redirect('http://169.254.169.254/latest/meta-data') });
    const outside = await request(app).get(`/api/geo/link?url=${encodeURIComponent('https://evil.example/maps?q=10.3,123.9')}`).expect(422);
    expect(outside.body.error).toMatch(/Google Maps link/);
    const bounced = await request(app).get(`/api/geo/link?url=${encodeURIComponent('https://maps.app.goo.gl/bad')}`).expect(422);
    expect(bounced.body.error).toMatch(/outside Google Maps/);
    // Only the first hop was fetched; the metadata address never was.
    expect(calls.map((c) => c.url.hostname)).toEqual(['maps.app.goo.gl']);
    await request(app).get(`/api/geo/link?url=${encodeURIComponent('http://maps.app.goo.gl/x')}`).expect(422); // not https
  });

  it('explains when a link has no location in it', async () => {
    const res = await request(app).get(`/api/geo/link?url=${encodeURIComponent('https://www.google.com/maps')}`).expect(422);
    expect(res.body.error).toMatch(/share it again|coordinates/);
  });
});
