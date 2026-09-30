import { execSync } from 'node:child_process';

// Bring the test database up to the latest migration before any test runs.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    // Override DIRECT_URL too: prisma.config.ts prefers it, and .env may
    // point it at a real (e.g. Neon) database.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
