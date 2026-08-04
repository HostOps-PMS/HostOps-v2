import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: {
    port: 5173,

    strictPort: true,

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
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
}))
