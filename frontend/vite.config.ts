import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache the app shell because Workbox generates a navigation fallback to index.html.
        // Without HTML in the precache manifest, createHandlerBoundToURL('index.html') throws
        // non-precached-url on SPA navigations in production.
        globPatterns: ['**/*.{html,js,css,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      manifest: {
        name: 'OBD2SW License Platform',
        short_name: 'OBD2SW',
        description: 'OBD2SW License Management Platform',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    process.env.BUNDLE_ANALYZE === 'true'
      ? visualizer({
        filename: 'dist/bundle-report.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      })
      : undefined,
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          const packagePath = id.split('node_modules/')[1] ?? ''
          const normalizedPackage = packagePath.startsWith('@')
            ? packagePath.split('/').slice(0, 2).join('/')
            : packagePath.split('/')[0]

          if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(normalizedPackage)) {
            return 'vendor-react'
          }

          if (normalizedPackage === '@tanstack/react-query') {
            return 'vendor-query'
          }

          if (['recharts', 'victory-vendor'].includes(normalizedPackage)) {
            return 'vendor-charts'
          }

          if (normalizedPackage.startsWith('@radix-ui/')) {
            return 'vendor-radix'
          }

          if (['i18next', 'react-i18next', 'i18next-browser-languagedetector'].includes(normalizedPackage)) {
            return 'vendor-i18n'
          }

          if (normalizedPackage === 'lucide-react') {
            return 'vendor-icons'
          }

          if (['axios', 'clsx', 'class-variance-authority', 'framer-motion', 'motion-dom', 'motion-utils', 'sonner', 'tailwind-merge', 'zustand'].includes(normalizedPackage)) {
            return 'vendor-ui'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3002,
    proxy: {
      '/api': {
        target:
          process.env.VITE_PROXY_TARGET
          ?? (fs.existsSync('/.dockerenv') ? 'http://nginx' : 'http://127.0.0.1'),
        changeOrigin: true,
        secure: false,
        ...(fs.existsSync('/.dockerenv')
          ? {}
          : {
            headers: {
              Host: 'license.test',
            },
          }),
      },
    },
  },
})
