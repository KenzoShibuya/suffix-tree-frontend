import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: 5173,
    proxy: {
      "/corpus": "http://localhost:8000",
      "/document": "http://localhost:8000",
      "/detect": "http://localhost:8000",
      "/benchmark": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
