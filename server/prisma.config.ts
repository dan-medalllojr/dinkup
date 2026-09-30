import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // The CLI (migrations, studio) uses the direct connection when one is set.
  // Neon's pooled URL goes through PgBouncer, which migrations can't use.
  // The running app connects via DATABASE_URL in src/db.ts.
  datasource: { url: process.env.DIRECT_URL || env('DATABASE_URL') },
});
