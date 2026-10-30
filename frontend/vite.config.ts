import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { securityPolicy } from "./config/security.ts";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: mode === 'e2e' ? { outDir: 'dist-e2e', sourcemap: 'hidden', manifest: true } : undefined,
  preview: mode === 'e2e' ? {
    proxy: { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: false } },
  } : undefined,
  server: {
    host: "::",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), securityPolicy(mode === 'e2e' ? '/api' : loadEnv(mode, process.cwd(), '').VITE_API_BASE_URL)],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
