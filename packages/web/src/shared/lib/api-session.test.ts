import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("fetchServerSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cookiesMock.mockReset();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns null without an API auth cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const { fetchServerSession } = await import("./api-session");

    await expect(fetchServerSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the API auth cookie to the backend session endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test/";
    const user = {
      id: "user-1",
      email: "user@example.com",
      name: "Finn User",
      image: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ authenticated: true, user }),
    });
    vi.stubGlobal("fetch", fetchMock);
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session token" }),
    });

    const { fetchServerSession } = await import("./api-session");

    await expect(fetchServerSession()).resolves.toEqual({ user });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/auth/session", {
      headers: {
        cookie: "finnn_session=session%20token",
      },
      cache: "no-store",
    });
  });

  it("builds server API request options from the API auth cookie", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session token" }),
    });

    const { getServerApiRequestOptions } = await import("./api-session");

    await expect(getServerApiRequestOptions()).resolves.toEqual({
      cache: "no-store",
      headers: {
        cookie: "finnn_session=session%20token",
      },
    });
  });

  it("returns null when the backend rejects the session lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      })
    );
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "expired" }),
    });

    const { fetchServerSession } = await import("./api-session");

    await expect(fetchServerSession()).resolves.toBeNull();
  });
});
