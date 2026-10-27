/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: funciona igual en Netlify, Vercel o GitHub Pages (/clara-dcep/)
export default defineConfig({
  base: './',
  // versión visible en Ajustes (hora de Londres al compilar)
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Clara · Hampshire DCEP',
        short_name: 'Clara DCEP',
        description: 'Estudio para la academia y el NIE',
        lang: 'es',
        theme_color: '#1e1b4b',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { environment: 'node' },
})
