import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const swSource = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

describe("service worker cache policy", () => {
  it("keeps the fetch handler behind a static asset allowlist", () => {
    expect(swSource).toContain("function isCacheableStaticAsset(request)");
    expect(swSource).toContain('"/_next/static/"');
    expect(swSource).toContain('["font", "image", "script", "style"].includes(request.destination)');
  });

  it("does not cache app documents, API responses, data routes, or non-GET requests", () => {
    expect(swSource).toContain('request.method !== "GET"');
    expect(swSource).toContain('request.destination === "document"');
    expect(swSource).toContain('url.pathname.startsWith("/api/")');
    expect(swSource).toContain('url.pathname.startsWith("/auth/users/")');
    expect(swSource).toContain('url.pathname.startsWith("/_next/data/")');
  });
});
