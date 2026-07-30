import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { requireApiBaseUrlForBuild } from "./src/shared/api/api-url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, rootDir, "VITE_");
    requireApiBaseUrlForBuild(env.VITE_API_URL);
  }

  return {
    optimizeDeps: {
      entries: ["index.html", "src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/**/*.stories.{ts,tsx}"],
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});
