import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const swSource = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
const registrationSource = readFileSync(
  join(process.cwd(), "src/shared/components/ServiceWorkerRegistration.tsx"),
  "utf8"
);

type CachePolicyRequest = {
  destination: string;
  method: string;
  url: string;
};

function loadCachePolicy(): (request: CachePolicyRequest) => boolean {
  const serviceWorker = {
    addEventListener: () => undefined,
    clients: { claim: () => undefined },
    location: { origin: "https://finnn.xyz" },
    skipWaiting: () => undefined,
  } as { cachePolicy?: (request: CachePolicyRequest) => boolean };

  runInNewContext(`${swSource}\nself.cachePolicy = isCacheableHashedAsset;`, {
    Response,
    caches: {},
    fetch: () => undefined,
    self: serviceWorker,
    URL,
  });

  if (!serviceWorker.cachePolicy) {
    throw new Error("Service-worker cache policy was not exposed to the test");
  }

  return serviceWorker.cachePolicy;
}

describe("service worker cache policy", () => {
  it("keeps the fetch handler behind a content-hashed Vite asset allowlist", () => {
    expect(swSource).toContain("function isCacheableHashedAsset(request)");
    expect(swSource).toContain("HASHED_ASSET_PATH_PATTERN");
    expect(swSource).toContain("/^\\/assets\\/.+-[A-Za-z0-9_-]{8,}");
  });

  it("does not cache documents, APIs, financial routes, public files, or non-GET requests", () => {
    const isCacheable = loadCachePolicy();
    const request = (url: string, destination = "script", method = "GET") => ({ destination, method, url });

    expect(isCacheable(request("https://finnn.xyz/assets/index-ABCdef12.js"))).toBe(true);
    expect(isCacheable(request("https://finnn.xyz/assets/index.js"))).toBe(false);
    expect(isCacheable(request("https://finnn.xyz/manifest.json", "manifest"))).toBe(false);
    expect(isCacheable(request("https://finnn.xyz/dashboard", "document"))).toBe(false);
    expect(isCacheable(request("https://finnn.xyz/api/assets/index-ABCdef12.js"))).toBe(false);
    expect(isCacheable(request("https://api.finnn.xyz/assets/index-ABCdef12.js"))).toBe(false);
    expect(isCacheable(request("https://finnn.xyz/assets/index-ABCdef12.js", "script", "POST"))).toBe(false);
  });

  it("serves hashed assets cache-first and only stores successful same-origin responses", () => {
    expect(swSource.indexOf("cache.match(event.request)")).toBeLessThan(swSource.indexOf("fetch(event.request)"));
    expect(swSource).toContain('response.status === 200 && response.type === "basic"');
    expect(swSource).toContain("cache.put(event.request, response.clone())");
  });

  it("reloads for worker updates without reloading the first controlled visit", () => {
    expect(registrationSource).toContain("const hadController = Boolean(navigator.serviceWorker.controller)");
    expect(registrationSource).toContain("if (hadController && !refreshing)");
  });
});
