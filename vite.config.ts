/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// Nur diese Node-Variable wird gebraucht; spart die Abhängigkeit @types/node.
declare const process: { env: Record<string, string | undefined> };

// Hintergrund des dunklen Modus; gilt auch für Startbildschirm und Statusleiste.
const THEMA_FARBE = '#080c11';

export default defineConfig({
  // GitHub Pages liefert unter /<repo-name>/ aus; der Workflow setzt BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    preact(),
    // HTTPS im LAN, damit Service Worker und Kamera auf dem Handy funktionieren.
    basicSsl(),
    VitePWA({
      // Neue Version wird im Hintergrund geladen und sofort aktiviert (Seite lädt neu).
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'CJ6-Repair',
        short_name: 'CJ6-Repair',
        description: 'Werkstatt-App für den Jeep CJ-6',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: THEMA_FARBE,
        theme_color: THEMA_FARBE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-Hülle vollständig vorab speichern, damit sie ohne Netz startet.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
