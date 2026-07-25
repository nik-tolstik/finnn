import { hexToRgb, type RGB, rgbToHex } from "@/shared/utils/color-utils";

export const ACCOUNT_ICON_MIN_CONTRAST_RATIO = 4.5;

const LIGHT_THEME_SURFACE: RGB = { r: 255, g: 255, b: 255 };
const DARK_THEME_SURFACE: RGB = { r: 42, g: 42, b: 42 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

export interface AccountIconColors {
  light: string;
  dark: string;
}

function getRelativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getRgbContrastRatio(first: RGB, second: RGB): number {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getHexContrastRatio(firstHex: string, secondHex: string): number | null {
  const first = hexToRgb(firstHex);
  const second = hexToRgb(secondHex);
  if (!first || !second) return null;

  return getRgbContrastRatio(first, second);
}

function mixRgb(source: RGB, target: RGB, amount: number): RGB {
  return {
    r: Math.round(source.r + (target.r - source.r) * amount),
    g: Math.round(source.g + (target.g - source.g) * amount),
    b: Math.round(source.b + (target.b - source.b) * amount),
  };
}

function getReadableColor(source: RGB, surface: RGB, correctionTarget: RGB): string {
  if (getRgbContrastRatio(source, surface) >= ACCOUNT_ICON_MIN_CONTRAST_RATIO) {
    return rgbToHex(source);
  }

  let low = 0;
  let high = 1;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const amount = (low + high) / 2;
    const candidate = mixRgb(source, correctionTarget, amount);

    if (getRgbContrastRatio(candidate, surface) >= ACCOUNT_ICON_MIN_CONTRAST_RATIO) {
      high = amount;
    } else {
      low = amount;
    }
  }

  return rgbToHex(mixRgb(source, correctionTarget, high));
}

export function getAccountIconColors(accountColor?: string | null): AccountIconColors {
  const source = accountColor ? hexToRgb(accountColor) : null;
  if (!source) {
    return {
      light: "var(--foreground)",
      dark: "var(--foreground)",
    };
  }

  return {
    light: getReadableColor(source, LIGHT_THEME_SURFACE, BLACK),
    dark: getReadableColor(source, DARK_THEME_SURFACE, WHITE),
  };
}
