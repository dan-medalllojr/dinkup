import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // shared/ ships TypeScript source, so bundle it into the server build.
  noExternal: ['@dinkup/shared'],
  sourcemap: true,
  clean: true,
});
