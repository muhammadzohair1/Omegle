import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        importScripts: ['/sw-bypass.js'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        globIgnores: ['model/**'],
        navigateFallbackDenylist: [/^\/ws-server/],
        runtimeCaching: [
          {
            urlPattern: /ws-server/,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'socket-io-bypass',
              backgroundSync: {
                name: 'socket-io-retry',
                options: {
                  maxRetentionTime: 60 * 1, // 1 minute
                },
              },
            },
          }
        ]
      },
      includeAssets: ['favicon.svg', 'pwa-icon-512.png'],
      manifest: {
        name: 'SmartChat - Random Video Chat',
        short_name: 'SmartChat',
        description: 'Premium random video chat with AI moderation.',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
