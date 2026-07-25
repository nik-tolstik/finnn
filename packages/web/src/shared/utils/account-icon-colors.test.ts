import { describe, expect, it } from "vitest";

import { ACCOUNT_ICON_MIN_CONTRAST_RATIO, getAccountIconColors, getHexContrastRatio } from "./account-icon-colors";

describe("account icon colors", () => {
  it("keeps white readable in the light theme and white in the dark theme", () => {
    const colors = getAccountIconColors("#ffffff");

    expect(colors.light).not.toBe("#ffffff");
    expect(colors.dark).toBe("#ffffff");
    expect(getHexContrastRatio(colors.light, "#ffffff")).toBeGreaterThanOrEqual(ACCOUNT_ICON_MIN_CONTRAST_RATIO);
  });

  it("keeps black readable in both themes", () => {
    const colors = getAccountIconColors("#000000");

    expect(colors.light).toBe("#000000");
    expect(colors.dark).not.toBe("#000000");
    expect(getHexContrastRatio(colors.dark, "#2a2a2a")).toBeGreaterThanOrEqual(ACCOUNT_ICON_MIN_CONTRAST_RATIO);
  });

  it("falls back to semantic foreground colors for missing account colors", () => {
    expect(getAccountIconColors(null)).toEqual({
      light: "var(--foreground)",
      dark: "var(--foreground)",
    });
  });
});
