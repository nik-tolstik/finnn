import { describe, expect, it, vi } from "vitest";

import { type ProtectedRouteKey, preloadMatchedProtectedRoute } from "./protected-route-preload";

function createLoaders() {
  const loaders = {
    analytics: vi.fn(async () => "analytics"),
    dashboard: vi.fn(async () => "dashboard"),
    debts: vi.fn(async () => "debts"),
    payments: vi.fn(async () => "payments"),
  } satisfies Record<ProtectedRouteKey, () => Promise<string>>;

  return loaders;
}

describe("protected route preloading", () => {
  it.each([
    "/dashboard",
    "/dashboard/",
    "/analytics?period=month",
    "/debts",
    "/payments",
  ])("starts only the matched route module for %s", async (pathname) => {
    const loaders = createLoaders();
    const expectedRoute = pathname.split("/").filter(Boolean)[0]?.split("?")[0] as ProtectedRouteKey;

    await expect(preloadMatchedProtectedRoute(pathname, loaders)).resolves.toBe(expectedRoute);

    for (const [route, loader] of Object.entries(loaders)) {
      expect(loader).toHaveBeenCalledTimes(route === expectedRoute ? 1 : 0);
    }
  });

  it("does not preload protected modules for public and unknown routes", () => {
    const loaders = createLoaders();

    expect(preloadMatchedProtectedRoute("/login", loaders)).toBeNull();
    expect(preloadMatchedProtectedRoute("/", loaders)).toBeNull();
    expect(Object.values(loaders).every((loader) => loader.mock.calls.length === 0)).toBe(true);
  });
});
