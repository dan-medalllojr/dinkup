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
    // Push off in tests (server/.env has dev keys): tests swap in a fake sender.
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' },
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    // The test database is on Neon (Singapore), so each query is a network
    // round trip. Vitest's 5s default is tight for multi-request tests.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
