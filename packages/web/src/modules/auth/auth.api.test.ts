import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from "./auth.api";

describe("auth avatar API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("uploads avatar FormData with credentials and without a manual content type", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "ada@example.com",
            name: "Ada",
            image: "/auth/users/user-1/avatar",
            telegram: { linked: false, username: null, displayName: null, photoUrl: null },
          },
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await uploadCurrentUserAvatar(file);

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/auth/user/avatar", {
      credentials: "include",
      headers: {},
      method: "POST",
      body: expect.any(FormData),
    });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("Content-Type");
  });

  it("clears avatar with credentials", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "ada@example.com",
            name: "Ada",
            image: null,
            telegram: { linked: false, username: null, displayName: null, photoUrl: null },
          },
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteCurrentUserAvatar();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/auth/user/avatar", {
      credentials: "include",
      headers: {},
      method: "DELETE",
    });
  });
});
