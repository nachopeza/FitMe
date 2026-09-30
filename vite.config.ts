import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `VITE_DISABLE_PWA=1` deja fuera el service worker. Se usa para la copia que se
 * publica como página compartida: ahí el service worker no tiene nada que
 * precargar y solo ensuciaría la consola con un 404.
 */
const pwa = process.env.VITE_DISABLE_PWA !== '1';

export default defineConfig({
  // Rutas relativas: así el build funciona igual servido desde la raíz del
  // dominio que desde una subcarpeta (página compartida, GitHub Pages…).
  base: './',
  plugins: [
    react(),
    pwa && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FitMe — Asistente nutricional',
        short_name: 'FitMe',
        description: 'Contador de macros y asistente nutricional para ganancia muscular controlada',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        // Relativos, para que la app se pueda instalar igual servida desde la
        // raíz de un dominio que desde una subcarpeta (GitHub Pages).
        start_url: './',
        scope: './',
        lang: 'es',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El módulo de IA no se precarga: es opcional y además inútil sin red.
        globIgnores: ['**/ai-*.js'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openfoodfacts',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as never);
