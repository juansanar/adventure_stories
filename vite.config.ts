import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Match server listen port in local dev (see server/index.mjs). Cloud Run sets PORT on the server only.
const apiOrigin = `http://127.0.0.1:${process.env.API_PORT || "8080"}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths work on GitHub Pages, Netlify, and file://
  base: "./",
  server: {
    proxy: {
      // Local dev: forward API calls to the Gemini backend server.
      "/api": apiOrigin,
    },
  },
  // `vite preview` does not inherit `server.proxy` unless mirrored here.
  preview: {
    proxy: {
      "/api": apiOrigin,
    },
  },
})
