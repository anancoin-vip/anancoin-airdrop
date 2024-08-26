import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  root: './app',
  server: {
    port: 8899,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, './app/src'),
    },
  },
  plugins: [react()],
})
