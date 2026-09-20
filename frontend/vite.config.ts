import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development Vite serves the React app on :5173 and the Go API runs on
    // :8080. This proxy forwards /api to the backend, so the browser sees one
    // origin and no cross-origin request ever happens. nginx does the same
    // job in Docker.
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
