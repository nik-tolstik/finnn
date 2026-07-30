import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, getApiBaseUrl } from "./http-client";

function stubBrowserHostname(hostname: string) {
  vi.stubGlobal("window", {
    location: { hostname },
  });
}

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("defaults to the local API during development when VITE_API_URL is empty", () => {
    vi.stubEnv("VITE_API_URL", "");
    stubBrowserHostname("localhost");

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("removes the trailing slash from the configured API URL", () => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:4000/");
    stubBrowserHostname("127.0.0.1");

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4000");
  });

  it("aligns loopback API hostname with the browser hostname so auth cookies are visible to web routes", () => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:4000/");
    stubBrowserHostname("localhost");

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("aligns the wildcard API listen host with the browser hostname", () => {
    vi.stubEnv("VITE_API_URL", "http://0.0.0.0:4000/");
    stubBrowserHostname("localhost");

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("keeps non-loopback API hosts unchanged", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    stubBrowserHostname("app.example.com");

    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });
});

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("wraps network failures with an actionable API connection error", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    stubBrowserHostname("app.example.com");
    const fetchMock = vi.fn().mockRejectedValue(new Error("Load failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient("/auth/login", { method: "POST" })).rejects.toThrow(
      "Не удалось подключиться к API: Load failed"
    );
  });
});
