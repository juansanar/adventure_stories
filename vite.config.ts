import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths work on GitHub Pages, Netlify, and file://
  base: "./",
  server: {
    proxy: {
      // Local dev: forward API calls to the Gemini backend server.
      "/api": "http://localhost:8080",
    },
  },
  // `vite preview` does not inherit `server.proxy` unless mirrored here.
  preview: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
})
