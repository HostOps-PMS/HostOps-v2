import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.hostops.online',
        changeOrigin: true,
      },
      '/auth': {
        target: 'https://api.hostops.online',
        changeOrigin: true,
      },
    },
    cors: {
      origin: [
        'https://hostops.online',
        'https://core.hostops.online',
        'https://go.hostops.online',
        'http://localhost:5174',
        'http://localhost:5173',
      ],
      credentials: true,
    },
  },
})