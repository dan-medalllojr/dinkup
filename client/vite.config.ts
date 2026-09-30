import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin in dev too, so session cookies behave like production.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
