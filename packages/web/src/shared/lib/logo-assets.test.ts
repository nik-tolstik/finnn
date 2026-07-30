import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readAsset = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("logo assets", () => {
  it("contains cropped monochrome light and dark variants", () => {
    const darkLogo = readAsset("public/logo-dark.svg");
    const lightLogo = readAsset("public/logo-light.svg");
    const markMask = readAsset("public/logo-mark-mask.svg");

    expect(darkLogo).toContain('viewBox="0 0 1025 1024"');
    expect(darkLogo).toContain('<rect x="0.343994" width="1024" height="1024" rx="256" fill="#1c1c1c"/>');
    expect(darkLogo).toContain('fill="#1c1c1c"');
    expect(darkLogo).toContain('fill="#f7f7f7"');
    expect(darkLogo).not.toContain("#2F6BFF");

    expect(lightLogo).toContain('viewBox="0 0 1025 1024"');
    expect(lightLogo).toContain('<rect x="0.343994" width="1024" height="1024" rx="256" fill="#f7f7f7"/>');
    expect(lightLogo).toContain('fill="#1c1c1c"');
    expect(lightLogo).toContain('fill="#f7f7f7"');
    expect(lightLogo).not.toContain("#2F6BFF");

    expect(markMask).toContain('viewBox="0 0 1025 1024"');
    expect(markMask.match(/<path /g)).toHaveLength(2);
    expect(markMask).not.toContain("<rect");
  });

  it("provides a system-theme-aware app icon and updated PWA references", () => {
    const appIcon = readAsset("src/app/icon.svg");
    const layout = readAsset("src/app/layout.tsx");
    const manifest = JSON.parse(readAsset("public/manifest.json")) as {
      background_color: string;
      theme_color: string;
      icons: Array<{ src: string; sizes?: string; type?: string }>;
    };
    const serviceWorker = readAsset("public/sw.js");

    expect(appIcon).toContain('viewBox="0 0 1025 1024"');
    expect(appIcon).toContain("prefers-color-scheme: dark");
    expect(appIcon).toContain("logo-background");
    expect(appIcon).toContain("#1c1c1c");
    expect(appIcon).toContain("#f7f7f7");
    expect(appIcon).not.toContain("#2F6BFF");
    expect(layout).toContain('color: "#f7f7f7"');
    expect(layout).toContain('color: "#1c1c1c"');
    expect(layout).not.toContain('url: "/favicon.ico"');
    expect(existsSync(join(process.cwd(), "src/app/favicon.ico"))).toBe(false);
    expect(manifest.background_color).toBe("#f7f7f7");
    expect(manifest.theme_color).toBe("#1c1c1c");
    expect(manifest.icons[0]).toEqual({
      src: "/logo-adaptive.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    });
    expect(serviceWorker).toContain('const CACHE_NAME = "finnn-v3";');
    expect(serviceWorker).toContain('"/logo-adaptive.svg"');
  });
});
