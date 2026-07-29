import { describe, expect, it } from "vitest";

import { getVisibleAccounts, resolveViewerUserId } from "./account-visibility";

describe("resolveViewerUserId", () => {
  it("uses the session user id when it is available", () => {
    expect(resolveViewerUserId("session-user", "server-user")).toBe("session-user");
  });

  it("falls back to the server user id before the session is ready", () => {
    expect(resolveViewerUserId(undefined, "server-user")).toBe("server-user");
  });

  it("returns null when both ids are missing", () => {
    expect(resolveViewerUserId(undefined, undefined)).toBeNull();
  });
});

describe("getVisibleAccounts", () => {
  const accounts = [
    { id: "1", ownerId: "user-1", hidden: false },
    { id: "2", ownerId: "user-2", hidden: false },
    { id: "3", ownerId: null, hidden: false },
    { id: "4", ownerId: "user-1", hidden: true },
  ];

  it("shows only the current user's accounts by default", () => {
    expect(getVisibleAccounts(accounts, "user-1", false)).toEqual([{ id: "1", ownerId: "user-1", hidden: false }]);
  });

  it("shows all accounts including hidden accounts when the toggle is enabled", () => {
    expect(getVisibleAccounts(accounts, "user-1", true)).toEqual(accounts);
  });

  it("shows all accounts when the viewer is unknown", () => {
    expect(getVisibleAccounts(accounts, null, false)).toEqual(accounts);
  });
});
