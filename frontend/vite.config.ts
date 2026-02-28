import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

          if (['axios', 'clsx', 'class-variance-authority', 'framer-motion', 'sonner', 'tailwind-merge', 'zustand'].includes(normalizedPackage)) {
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
    port: 3000,
  },
})
