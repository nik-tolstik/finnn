import { describe, expect, it } from "vitest";

import { getThemeLogoPath } from "./theme-logo";

describe("getThemeLogoPath", () => {
  it("returns the dark logo for the light theme", () => {
    expect(getThemeLogoPath("light")).toBe("/logo-dark.svg");
  });

  it("returns the light logo for the dark theme", () => {
    expect(getThemeLogoPath("dark")).toBe("/logo-light.svg");
  });

  it("ignores unresolved themes", () => {
    expect(getThemeLogoPath("system")).toBeNull();
    expect(getThemeLogoPath(undefined)).toBeNull();
  });
});
