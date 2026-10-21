
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,

    proxy: {
      // Express.js + MongoDB endpoints
      "/api/predictions": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },

      // Existing FastAPI ML endpoints
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
