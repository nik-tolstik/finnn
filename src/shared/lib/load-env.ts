type ProcessWithLoadEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

const ENV_FILE_PATHS = [".env", ".env.local"] as const;

const processWithLoadEnvFile = process as ProcessWithLoadEnvFile;

// Mirror Next.js-style env loading for standalone tsx scripts.
if (typeof processWithLoadEnvFile.loadEnvFile === "function") {
  for (const envFilePath of ENV_FILE_PATHS) {
    try {
      processWithLoadEnvFile.loadEnvFile(envFilePath);
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;

      if (errorCode !== "ENOENT") {
        throw error;
      }
    }
  }
}
