import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * vite-plugin-pwa inyecta el manifest del huésped en TODOS los html de entrada, incluido
 * admin.html, que ya declara el suyo. Dos <link rel="manifest"> funcionan por accidente
 * —gana el primero— pero es justo la ambigüedad que hacía que el iPhone instalara la app
 * equivocada, así que se elimina el sobrante.
 *
 * Corre en closeBundle y se registra ANTES de VitePWA para que el html ya esté escrito en
 * disco pero el service worker todavía no haya calculado su hash: al revés, el precache
 * apuntaría a una versión del archivo que ya no existe.
 */
function keepAdminManifest(): Plugin {
  return {
    name: 'keep-admin-manifest',
    apply: 'build',
    closeBundle() {
      const file = resolve(__dirname, 'dist/admin.html')
      if (!existsSync(file)) return
      const html = readFileSync(file, 'utf-8')
      const cleaned = html.replace(/\s*<link rel="manifest" href="\/manifest\.webmanifest"\s*\/?>/g, '')
      if (cleaned !== html) writeFileSync(file, cleaned)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    keepAdminManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-96x96.png', 'icons.svg', 'apple-touch-icon.png'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Sin esto el service worker respondería /admin con el index del huésped desde
        // caché, y el iPhone volvería a instalar la app equivocada.
        navigateFallbackDenylist: [/^\/admin/],
      },
      manifest: {
        id: '/',
        name: 'Estancia La Cañada',
        short_name: 'La Cañada',
        description: 'Reservas, restaurante y excursiones de Estancia La Cañada',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FDFBF7',
        theme_color: '#A65D47',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          // Android recorta el icono a la forma del launcher; este lleva margen de seguridad.
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
