/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        // PG core-first test backend (serverPg.ts). Was :3006 (Mongo index.ts).
        target: 'http://localhost:3019',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
