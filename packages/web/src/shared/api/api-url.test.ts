import { describe, expect, it } from "vitest";

import { normalizeApiBaseUrl, requireApiBaseUrlForBuild } from "./api-url";

describe("normalizeApiBaseUrl", () => {
  it("normalizes surrounding whitespace and trailing slashes", () => {
    expect(normalizeApiBaseUrl("  https://api.example.com/v1///  ")).toBe("https://api.example.com/v1");
  });

  it.each([
    "api.example.com",
    "ftp://api.example.com",
    "https://user:password@api.example.com",
    "https://api.example.com?workspace=one",
    "https://api.example.com#status",
  ])("rejects an invalid API URL: %s", (value) => {
    expect(() => normalizeApiBaseUrl(value)).toThrow(
      "VITE_API_URL must be an absolute HTTP(S) URL without credentials, query parameters, or a hash."
    );
  });
});

describe("requireApiBaseUrlForBuild", () => {
  it.each([undefined, "", "   "])("rejects a missing production API URL: %s", (value) => {
    expect(() => requireApiBaseUrlForBuild(value)).toThrow("VITE_API_URL is required for production builds");
  });

  it("returns a normalized valid production API URL", () => {
    expect(requireApiBaseUrlForBuild("https://api.finnn.xyz/")).toBe("https://api.finnn.xyz");
  });
});
