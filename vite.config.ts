import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bolsillo — Organizador de gastos',
        short_name: 'Bolsillo',
        description: 'Organiza tus gastos y metas de ahorro.',
        theme_color: '#f5f6f2',
        background_color: '#f5f6f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  server: { host: '0.0.0.0' }
});
