import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ask before swapping in a new version, so an update never reloads the
      // page while someone is filling in a form.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Dinkup: Pickleball in Cebu',
        short_name: 'Dinkup',
        description: 'Find a pickleball game in Cebu.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f7a4d',
        background_color: '#f6f7f2',
        categories: ['sports', 'social'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell (HTML, JS, CSS, icons) so it opens offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Client-side routes fall back to the cached index.html, except the
        // API, which must always hit the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // No runtime caching of /api: stale game lists or player counts would
        // be worse than a clear "you're offline" message. Map tiles aren't
        // cached either (OpenStreetMap's tile policy discourages it).
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // Same-origin in dev too, so session cookies behave like production.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
