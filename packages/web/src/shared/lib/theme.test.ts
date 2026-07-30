import { describe, expect, it, vi } from "vitest";

import { parseTheme, readTheme, resolveTheme, THEME_STORAGE_KEY, writeTheme } from "./theme";

describe("theme", () => {
  it("accepts supported values and defaults invalid values to the system theme", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });

  it("resolves the system theme from the color-scheme preference", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("reads the existing theme key and falls back when storage is unavailable", () => {
    expect(readTheme({ getItem: vi.fn().mockReturnValue("dark"), setItem: vi.fn() })).toBe("dark");
    expect(
      readTheme({
        getItem: vi.fn().mockImplementation(() => {
          throw new Error("Storage unavailable");
        }),
        setItem: vi.fn(),
      })
    ).toBe("system");
  });

  it("preserves the storage key used by the previous theme integration", () => {
    const setItem = vi.fn();

    writeTheme({ getItem: vi.fn(), setItem }, "light");

    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "light");
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});
