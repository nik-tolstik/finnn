/** biome-ignore-all lint/suspicious/noConsole: logger */
type LogLevel = "debug" | "info" | "warn" | "error";

const emit = (level: LogLevel, ...args: unknown[]) => {
  switch (level) {
    case "debug":
      console.debug("[Server]", ...args);
      break;
    case "info":
      console.info("[Server]", ...args);
      break;
    case "warn":
      console.warn("[Server]", ...args);
      break;
    case "error":
      console.error("[Server]", ...args);
      break;
    default:
      console.log("[Server]", ...args);
  }
};

export const serverLogger = {
  debug: (...args: unknown[]) => emit("debug", ...args),
  info: (...args: unknown[]) => emit("info", ...args),
  warn: (...args: unknown[]) => emit("warn", ...args),
  error: (...args: unknown[]) => emit("error", ...args),
};
