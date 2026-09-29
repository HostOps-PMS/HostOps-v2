import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: {
    port: 5174,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
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
    fs: {
      strict: true,
      allow: ['.'],
      deny: ['.env', '.env.*', '*.pem', '*.key'],
    },
  },

  build: {
    sourcemap: mode === 'production' ? false : true,
    target: 'es2020',

    rollupOptions: {
      output: {
        // Avoid predictable/guessable asset filenames.
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
}))