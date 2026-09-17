import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo Vite sirve el React en :5173 y el Go vive en :8080.
    // Este proxy reenvía /api al backend, así el navegador cree que todo
    // sale del mismo origen y no aparece ningún problema de CORS.
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
