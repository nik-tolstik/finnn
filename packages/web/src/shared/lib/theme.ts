export const THEME_STORAGE_KEY = "theme";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function parseTheme(value: string | null): ThemeMode {
  return isThemeMode(value) ? value : "system";
}

export function readTheme(storage: ThemeStorage): ThemeMode {
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function writeTheme(storage: ThemeStorage, theme: ThemeMode): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme remains available for the current session.
  }
}

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return theme;
}
