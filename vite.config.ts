import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /foody/.
export default defineConfig({
  base: '/foody/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'foody — tarif defterim',
        short_name: 'foody',
        description: 'Kendi tariflerin, fotoğrafların, gramların ve kalorilerin.',
        lang: 'tr',
        theme_color: '#0F0E0D',
        background_color: '#0F0E0D',
        display: 'standalone',
        start_url: '/foody/',
        scope: '/foody/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ],
  test: {
    environment: 'node'
  }
});
