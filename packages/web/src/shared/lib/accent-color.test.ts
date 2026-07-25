import { describe, expect, it, vi } from "vitest";

import {
  ACCENT_COLOR_OPTIONS,
  ACCENT_COLOR_STORAGE_KEY,
  DEFAULT_ACCENT_COLOR,
  parseAccentColor,
  readAccentColor,
  writeAccentColor,
} from "./accent-color";

describe("accent color", () => {
  it("exposes the five supported colors with blue as the default", () => {
    expect(ACCENT_COLOR_OPTIONS.map((option) => option.value)).toEqual(["blue", "pink", "green", "orange", "violet"]);
    expect(DEFAULT_ACCENT_COLOR).toBe("blue");
  });

  it("accepts supported values and falls back for invalid values", () => {
    expect(parseAccentColor("pink")).toBe("pink");
    expect(parseAccentColor("violet")).toBe("violet");
    expect(parseAccentColor(null)).toBe(DEFAULT_ACCENT_COLOR);
    expect(parseAccentColor("yellow")).toBe(DEFAULT_ACCENT_COLOR);
  });

  it("reads a stored color and falls back when storage is invalid", () => {
    expect(
      readAccentColor({
        getItem: vi.fn().mockReturnValue("green"),
        setItem: vi.fn(),
      })
    ).toBe("green");

    expect(
      readAccentColor({
        getItem: vi.fn().mockImplementation(() => {
          throw new Error("Storage unavailable");
        }),
        setItem: vi.fn(),
      })
    ).toBe(DEFAULT_ACCENT_COLOR);
  });

  it("stores the selected color under the versioned key", () => {
    const setItem = vi.fn();

    writeAccentColor({ getItem: vi.fn(), setItem }, "orange");

    expect(setItem).toHaveBeenCalledWith(ACCENT_COLOR_STORAGE_KEY, "orange");
  });
});
