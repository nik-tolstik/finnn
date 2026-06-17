import { describe, expect, it, vi } from "vitest";

import { bumpUploadedAvatarVersion, getUploadedAvatarVersion, isUploadedAvatarPath } from "./avatar-cache-bust";

describe("avatar cache busting", () => {
  it("tracks versions only for uploaded avatar paths", () => {
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    bumpUploadedAvatarVersion("/auth/users/user-1/avatar");
    bumpUploadedAvatarVersion("/avatars/animals/cat-01.svg");

    expect(isUploadedAvatarPath("/auth/users/user-1/avatar")).toBe(true);
    expect(isUploadedAvatarPath("/avatars/animals/cat-01.svg")).toBe(false);
    expect(getUploadedAvatarVersion("/auth/users/user-1/avatar")).toBe(String(Date.now()));
    expect(getUploadedAvatarVersion("/avatars/animals/cat-01.svg")).toBeNull();

    vi.useRealTimers();
  });
});
