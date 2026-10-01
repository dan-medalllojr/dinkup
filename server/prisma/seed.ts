import { distanceKm, DUPLICATE_COURT_METERS } from '@dinkup/shared';
import { pool, prisma } from '../src/db.ts';
import { env } from '../src/env.ts';
import { ensureDemoData } from '../src/lib/demo.ts';
import { COURTS } from './data/courts.ts';

async function seedCourts() {
  const pinned = COURTS.filter((c) => c.lat !== null && c.lng !== null);
  const unpinned = COURTS.length - pinned.length;

  const known = new Set((await prisma.court.findMany({ select: { slug: true } })).map((c) => c.slug));
  const playerAdded = await prisma.court.findMany({
    where: { addedById: { not: null } },
    select: { name: true, lat: true, lng: true },
  });

  let seeded = 0;
  const skipped: string[] = [];
  for (const { lat, lng, ...court } of pinned) {
    const data = { ...court, lat: lat!, lng: lng! };
    // A player may have added this venue before we curated it. Keep theirs
    // (games may point at it) rather than putting a second pin on the spot.
    const dupe = !known.has(court.slug) && playerAdded.find((c) => distanceKm(c, data) * 1000 < DUPLICATE_COURT_METERS);
    if (dupe) {
      skipped.push(`${court.name} (player-added "${dupe.name}" is already there)`);
      continue;
    }
    // Upsert by slug so re-running the seed updates rather than duplicates.
    await prisma.court.upsert({ where: { slug: court.slug }, create: data, update: data });
    seeded++;
  }

  console.log(`Courts: ${seeded} seeded, ${unpinned} skipped (no pin yet — see prisma/data/courts.ts)`);
  for (const s of skipped) console.log(`  Skipped ${s}`);
}

try {
  await seedCourts();
  if (env.DEMO_MODE) {
    const r = await ensureDemoData();
    console.log(`Demo: ${r.created} games created, ${r.removedGames} old games and ${r.removedVisitors} expired visitors removed`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
