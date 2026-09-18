import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/health": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/days": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/trades": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/summary": { target: "http://127.0.0.1:8001", changeOrigin: true },
    },
  },
});
