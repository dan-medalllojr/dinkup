import { describe, expect, it } from 'vitest';
import { groupNearby } from '@dinkup/shared';

const pt = (item: string, x: number, y: number) => ({ item, x, y });

describe('groupNearby', () => {
  it('keeps far-apart points on their own', () => {
    expect(groupNearby([pt('a', 0, 0), pt('b', 100, 0), pt('c', 0, 100)], 44)).toEqual([['a'], ['b'], ['c']]);
  });

  it('groups points closer than the radius', () => {
    expect(groupNearby([pt('a', 0, 0), pt('b', 20, 10), pt('c', 200, 200), pt('d', 210, 195)], 44)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('merges until no two markers overlap', () => {
    // a+b merge (30 px apart) and are drawn at x=15; c at 50 is then only
    // 35 px from that middle, so it joins too.
    expect(groupNearby([pt('a', 0, 0), pt('b', 30, 0), pt('c', 50, 0)], 44)).toEqual([['a', 'b', 'c']]);
    // A point far enough from the middle stays on its own.
    expect(groupNearby([pt('a', 0, 0), pt('b', 30, 0), pt('c', 70, 0)], 44)).toEqual([['a', 'b'], ['c']]);
  });

  it('leaves every marker at least the radius from every other', () => {
    const pts = Array.from({ length: 40 }, (_, i) => pt(String(i), (i * 37) % 300, (i * 53) % 300));
    const groups = groupNearby(pts, 44);
    const middle = (g: string[]) => {
      const ps = g.map((id) => pts.find((p) => p.item === id)!);
      return [ps.reduce((s, p) => s + p.x, 0) / ps.length, ps.reduce((s, p) => s + p.y, 0) / ps.length] as const;
    };
    const ms = groups.map(middle);
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) expect(Math.hypot(ms[i]![0] - ms[j]![0], ms[i]![1] - ms[j]![1])).toBeGreaterThanOrEqual(44);
    expect(groups.flat().sort()).toEqual(pts.map((p) => p.item).sort());
  });

  it('treats the radius as exclusive and handles no points', () => {
    expect(groupNearby([pt('a', 0, 0), pt('b', 44, 0)], 44)).toEqual([['a'], ['b']]);
    expect(groupNearby([], 44)).toEqual([]);
  });
});
