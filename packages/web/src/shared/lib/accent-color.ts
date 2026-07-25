export const ACCENT_COLOR_STORAGE_KEY = "finnn:appearance-accent-color:v1";

export const DEFAULT_ACCENT_COLOR = "blue" as const;

export type AccentColor = "blue" | "pink" | "green" | "orange" | "violet";

export interface AccentColorOption {
  value: AccentColor;
  label: string;
}

export const ACCENT_COLOR_OPTIONS: readonly AccentColorOption[] = [
  { value: "blue", label: "Синий" },
  { value: "pink", label: "Розовый" },
  { value: "green", label: "Зелёный" },
  { value: "orange", label: "Оранжевый" },
  { value: "violet", label: "Фиолетовый" },
];

export interface AccentColorStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isAccentColor(value: unknown): value is AccentColor {
  return value === "blue" || value === "pink" || value === "green" || value === "orange" || value === "violet";
}

export function parseAccentColor(value: string | null): AccentColor {
  return isAccentColor(value) ? value : DEFAULT_ACCENT_COLOR;
}

export function readAccentColor(storage: AccentColorStorage): AccentColor {
  try {
    return parseAccentColor(storage.getItem(ACCENT_COLOR_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function writeAccentColor(storage: AccentColorStorage, value: AccentColor): void {
  try {
    storage.setItem(ACCENT_COLOR_STORAGE_KEY, value);
  } catch {
    // The selected color remains available for the current session.
  }
}
