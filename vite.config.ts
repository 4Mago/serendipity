import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' rather than 'autoUpdate': swapping the app out from under
      // someone mid-shop is worse than showing a small "new version" nudge.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hemma',
        short_name: 'Hemma',
        description: 'Meal plan, shopping, budget and schedule for Marcus & Clara',
        lang: 'sv-SE',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf6ee',
        theme_color: '#faf6ee',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // API traffic must never be served from the precache — freshness there
        // is the whole point, and TanStack Query owns that cache instead.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        runtimeCaching: [
          {
            // Recipe photos are immutable once uploaded, so cache hard.
            urlPattern: /^\/api\/uploads\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // `netlify dev` proxies to Vite; functions are reached through it.
    proxy: {
      '/api': 'http://localhost:8888',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
