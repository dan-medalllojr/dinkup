import { pool, prisma } from '../src/db.ts';
import { COURTS } from './data/courts.ts';

async function seedCourts() {
  const pinned = COURTS.filter((c) => c.lat !== null && c.lng !== null);
  const unpinned = COURTS.length - pinned.length;

  for (const { lat, lng, ...court } of pinned) {
    const data = { ...court, lat: lat!, lng: lng! };
    // Upsert by slug so re-running the seed updates rather than duplicates.
    await prisma.court.upsert({ where: { slug: court.slug }, create: data, update: data });
  }

  console.log(`Courts: ${pinned.length} seeded, ${unpinned} skipped (no pin yet — see prisma/data/courts.ts)`);
}

try {
  await seedCourts();
} finally {
  await prisma.$disconnect();
  await pool.end();
}
