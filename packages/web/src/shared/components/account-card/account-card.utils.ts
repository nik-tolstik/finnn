import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/shared/utils/color-utils";

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
