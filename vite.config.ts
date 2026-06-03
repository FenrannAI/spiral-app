import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/spiral-app/' : '/',
  plugins: [react()],
  server: {
    host: '192.168.1.159',
  },
  build: {
    sourcemap: false,   // don't ship source maps to production
  },
}))
