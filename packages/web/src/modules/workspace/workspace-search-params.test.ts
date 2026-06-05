import { describe, expect, it } from "vitest";

import { buildWorkspaceSearchString, resolveWorkspaceIdFromList } from "./workspace-search-params";

describe("workspace search params", () => {
  const workspaces = [{ id: "workspace-1" }, { id: "workspace-2" }];

  it("keeps a valid requested workspace and falls back to the first available workspace", () => {
    expect(resolveWorkspaceIdFromList(workspaces, "workspace-2")).toBe("workspace-2");
    expect(resolveWorkspaceIdFromList(workspaces, "missing")).toBe("workspace-1");
    expect(resolveWorkspaceIdFromList(workspaces, null)).toBe("workspace-1");
    expect(resolveWorkspaceIdFromList([], "workspace-1")).toBeNull();
  });

  it("updates workspaceId while preserving other route filters", () => {
    const nextSearch = buildWorkspaceSearchString(new URLSearchParams("type=expense&workspaceId=old"), "workspace-1");

    expect(nextSearch).toBe("type=expense&workspaceId=workspace-1");
  });
});
