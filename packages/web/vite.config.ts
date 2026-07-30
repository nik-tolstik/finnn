import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  optimizeDeps: {
    entries: ["index.html", "src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/**/*.stories.{ts,tsx}"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
