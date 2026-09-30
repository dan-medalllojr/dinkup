import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ quiet: true });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL must be set to run tests');
// Tests TRUNCATE every table. Refuse to run against anything not named *_test
// so a misconfigured .env can't wipe a real database.
if (!new URL(testDatabaseUrl).pathname.endsWith('_test')) {
  throw new Error(`TEST_DATABASE_URL must point at a database whose name ends in "_test" (got ${new URL(testDatabaseUrl).pathname})`);
}

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl },
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
