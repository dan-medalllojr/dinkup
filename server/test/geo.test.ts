import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceKm } from '@dinkup/shared';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 10.3, lng: 123.9 }, { lat: 10.3, lng: 123.9 })).toBe(0);
  });

  it('measures one degree of latitude as ~111.19 km', () => {
    expect(distanceKm({ lat: 10, lng: 123.9 }, { lat: 11, lng: 123.9 })).toBeCloseTo(111.19, 1);
  });

  it('is symmetric', () => {
    const a = { lat: 10.26, lng: 123.83 };
    const b = { lat: 10.32, lng: 123.99 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });
});

describe('directionsUrl', () => {
  it('builds a Google Maps directions link', () => {
    expect(directionsUrl({ lat: 10.3, lng: 123.9 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=10.3,123.9',
    );
  });
});
