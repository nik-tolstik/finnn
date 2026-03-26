import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/shared/utils/color-utils";

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "").trim();
  const normalizedHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const r = parseInt(normalizedHex.slice(0, 2), 16);
  const g = parseInt(normalizedHex.slice(2, 4), 16);
  const b = parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLightThemeIconColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "var(--foreground)";

  const hsl = rgbToHsl(rgb);
  return rgbToHex(
    hslToRgb({
      ...hsl,
      s: Math.max(hsl.s, 48),
      l: Math.min(hsl.l, 34),
    })
  );
}
