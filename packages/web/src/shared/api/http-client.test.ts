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
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns the configured API URL on the server", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4000/";

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4000");
  });

  it("aligns loopback API hostname with the browser hostname so auth cookies are visible to web routes", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4000/";
    stubBrowserHostname("localhost");

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("aligns the wildcard API listen host with the browser hostname", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://0.0.0.0:4000/";
    stubBrowserHostname("localhost");

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("keeps non-loopback API hosts unchanged", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    stubBrowserHostname("app.example.com");

    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });
});

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("wraps network failures with an actionable API connection error", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    const fetchMock = vi.fn().mockRejectedValue(new Error("Load failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient("/auth/login", { method: "POST" })).rejects.toThrow(
      "Не удалось подключиться к API: Load failed"
    );
  });
});
