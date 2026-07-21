import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single-container build: output goes straight into the Flask static folder.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../backend/static",
    emptyOutDir: true,
  },
  server: {
    port: 9175,
    proxy: {
      "/api": "http://localhost:9174",
    },
  },
});
