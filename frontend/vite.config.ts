import { defineConfig } from "vitest/config";
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
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx only mounts the app; the rest is test scaffolding and types.
      exclude: ["src/main.tsx", "src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
