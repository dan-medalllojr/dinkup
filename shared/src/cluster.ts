// Groups points that sit closer than `radius` to each other (in screen pixels,
// for map pins). A group is drawn at the middle of its points, so after the
// first pass a group can land on top of another marker; groups whose middles
// are still too close keep merging until every marker is at least `radius`
// from every other. Deterministic, and plenty for a few dozen pins.
export type ScreenPoint<T> = { item: T; x: number; y: number };

type Group<T> = { items: T[]; x: number; y: number; n: number };

export function groupNearby<T>(points: ScreenPoint<T>[], radius: number): T[][] {
  let groups: Group<T>[] = points.map((p) => ({ items: [p.item], x: p.x, y: p.y, n: 1 }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]!;
        const b = groups[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) >= radius) continue;
        const n = a.n + b.n;
        groups[i] = { items: [...a.items, ...b.items], x: (a.x * a.n + b.x * b.n) / n, y: (a.y * a.n + b.y * b.n) / n, n };
        groups = groups.filter((_, k) => k !== j);
        merged = true;
        break outer;
      }
    }
  }
  return groups.map((g) => g.items);
}
