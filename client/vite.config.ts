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
        // ...except the map engine (MapLibre, ~280 KB gzipped): don't make every
        // install download it up front on mobile data. It's cached the first
        // time someone opens a map instead (runtime rule below).
        globIgnores: ['**/CourtMap-*.{js,css}', '**/maplibre-gl-worker-*.js'],
        // Client-side routes fall back to the cached index.html, except the
        // API, which must always hit the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // No runtime caching of /api: stale game lists or player counts would
        // be worse than a clear "you're offline" message. Map tiles aren't
        // cached either; the map needs a connection.
        runtimeCaching: [
          {
            // Content-hashed, so cache-first is safe: a new build has a new name.
            urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/(CourtMap|maplibre-gl-worker)-.*\.(js|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-engine',
              expiration: { maxEntries: 4 },
              plugins: [
                {
                  // Only ever keep real scripts and styles. A missing old chunk
                  // once came back as index.html and got cached as "JavaScript".
                  cacheWillUpdate: async ({ response }) =>
                    response.ok && /javascript|css/.test(response.headers.get('content-type') ?? '') ? response : null,
                },
              ],
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  // MapLibre's worker is an ES module (it imports shared code).
  worker: { format: 'es' },
  build: {
    // The one big chunk is the MapLibre map engine (~1 MB raw, ~280 KB gzipped).
    // It's lazy-loaded on map pages only, so raise the warning past it.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5173,
    // Same-origin in dev too, so session cookies behave like production.
    // API_PORT: when 3000 is taken, run e.g. `PORT=4317 API_PORT=4317 npm run dev`.
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3000}` },
  },
});
