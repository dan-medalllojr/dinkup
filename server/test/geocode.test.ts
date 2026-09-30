import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { setGeocodeFetch } from '../src/lib/geocode.ts';
import { app } from './helpers.ts';

type Call = { url: URL; userAgent: string | null; at: number };

function fakeNominatim(body: unknown, status = 200) {
  const calls: Call[] = [];
  setGeocodeFetch((async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), userAgent: new Headers(init?.headers).get('User-Agent'), at: Date.now() });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch);
  return calls;
}

afterEach(() => setGeocodeFetch(fetch));

const lahug = {
  lat: '10.3301',
  lon: '123.8987',
  name: 'Lahug Sports Complex',
  display_name: 'Lahug Sports Complex, Gorordo Avenue, Lahug, Cebu City, Central Visayas, Philippines',
  address: { road: 'Gorordo Avenue', suburb: 'Lahug', city: 'Cebu City' },
};

describe('GET /api/geo/search', () => {
  it('proxies to Nominatim within Cebu, with our User-Agent, and shapes the results', async () => {
    const calls = fakeNominatim([lahug]);
    const res = await request(app).get('/api/geo/search?q=Lahug sports').expect(200);
    expect(res.body.places).toEqual([
      { label: 'Lahug Sports Complex', address: 'Gorordo Avenue, Lahug', city: 'Cebu City', lat: 10.3301, lng: 123.8987 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.userAgent).toMatch(/^Dinkup\//);
    expect(calls[0]!.url.searchParams.get('countrycodes')).toBe('ph');
    expect(calls[0]!.url.searchParams.get('bounded')).toBe('1');
  });

  it('caches repeat searches so Nominatim is only asked once', async () => {
    const calls = fakeNominatim([lahug]);
    await request(app).get('/api/geo/search?q=Lahug').expect(200);
    await request(app).get('/api/geo/search?q=  LAHUG ').expect(200);
    expect(calls).toHaveLength(1);
  });

  it('spaces out requests to at most one per second', async () => {
    const calls = fakeNominatim([]);
    await Promise.all([request(app).get('/api/geo/search?q=first'), request(app).get('/api/geo/search?q=second')]);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(1000);
  });

  it('rejects too-short queries and reports upstream failures clearly', async () => {
    fakeNominatim({}, 503);
    await request(app).get('/api/geo/search?q=ab').expect(400);
    const res = await request(app).get('/api/geo/search?q=anything').expect(502);
    expect(res.body.error).toMatch(/drop a pin/);
  });
});

describe('GET /api/geo/reverse', () => {
  it('returns the address at a point, keeping the exact coordinates', async () => {
    fakeNominatim(lahug);
    const res = await request(app).get('/api/geo/reverse?lat=10.33012&lng=123.89871').expect(200);
    expect(res.body.place).toMatchObject({ address: 'Gorordo Avenue, Lahug', city: 'Cebu City', lat: 10.33012, lng: 123.89871 });
  });

  it('returns null when Nominatim has nothing there', async () => {
    fakeNominatim({ error: 'Unable to geocode' });
    const res = await request(app).get('/api/geo/reverse?lat=10.1&lng=124.3').expect(200);
    expect(res.body.place).toBeNull();
  });
});
