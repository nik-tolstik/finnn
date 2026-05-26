import { beforeEach, describe, expect, it, vi } from "vitest";

const createApiWorkspaceMock = vi.fn();
const getApiWorkspaceMembersMock = vi.fn();
const getApiWorkspaceSummaryMock = vi.fn();
const leaveApiWorkspaceMock = vi.fn();
const listApiWorkspacesMock = vi.fn();
const updateApiWorkspaceMock = vi.fn();
const getServerApiRequestOptionsMock = vi.fn();
const revalidateWorkspaceRoutesMock = vi.fn();

vi.mock("@/shared/api/generated/workspaces/workspaces", () => ({
  createWorkspace: createApiWorkspaceMock,
  getWorkspaceMembers: getApiWorkspaceMembersMock,
  getWorkspaceSummary: getApiWorkspaceSummaryMock,
  leaveWorkspace: leaveApiWorkspaceMock,
  listWorkspaces: listApiWorkspacesMock,
  updateWorkspace: updateApiWorkspaceMock,
}));

vi.mock("@/shared/lib/api-session", () => ({
  getServerApiRequestOptions: getServerApiRequestOptionsMock,
}));

vi.mock("@/shared/lib/revalidate-app-routes", () => ({
  revalidateWorkspaceRoutes: revalidateWorkspaceRoutesMock,
}));

function createWorkspaceDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "workspace-1",
    name: "Family",
    slug: "family",
    icon: null,
    baseCurrency: "BYN",
    ownerId: "user-1",
    membersCount: 2,
    owner: {
      id: "user-1",
      name: "Finn",
      email: "finn@example.com",
      image: null,
    },
    ...overrides,
  };
}

describe("workspace.service API adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerApiRequestOptionsMock.mockResolvedValue({
      cache: "no-store",
      headers: { cookie: "finnn_session=token" },
    });
  });

  it("maps listWorkspaces response to the existing ActionResult workspace list shape", async () => {
    listApiWorkspacesMock.mockResolvedValue({
      workspaces: [createWorkspaceDto({ icon: "Wallet" })],
    });

    const { getWorkspaces } = await import("./workspace.service");
    const result = await getWorkspaces();

    expect(listApiWorkspacesMock).toHaveBeenCalledWith({
      cache: "no-store",
      headers: { cookie: "finnn_session=token" },
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "workspace-1",
          name: "Family",
          slug: "family",
          icon: "Wallet",
          baseCurrency: "BYN",
          ownerId: "user-1",
          owner: {
            id: "user-1",
            name: "Finn",
            email: "finn@example.com",
            image: null,
          },
          _count: {
            members: 2,
          },
        }),
      ],
    });
  });

  it("maps summary and members responses to existing data payloads", async () => {
    getApiWorkspaceSummaryMock.mockResolvedValue({
      workspace: createWorkspaceDto({ icon: "Wallet" }),
    });
    getApiWorkspaceMembersMock.mockResolvedValue({
      members: [
        {
          id: "user-1",
          name: "Finn",
          email: "finn@example.com",
          image: null,
          role: "owner",
        },
      ],
    });

    const { getWorkspaceMembers, getWorkspaceSummary } = await import("./workspace.service");

    await expect(getWorkspaceSummary("workspace-1")).resolves.toEqual({
      data: {
        id: "workspace-1",
        name: "Family",
        icon: "Wallet",
        baseCurrency: "BYN",
        ownerId: "user-1",
      },
    });
    await expect(getWorkspaceMembers("workspace-1")).resolves.toEqual({
      data: [
        {
          id: "user-1",
          name: "Finn",
          email: "finn@example.com",
          image: null,
        },
      ],
    });
  });

  it("revalidates routes after workspace mutations", async () => {
    createApiWorkspaceMock.mockResolvedValue({
      workspace: createWorkspaceDto(),
    });
    updateApiWorkspaceMock.mockResolvedValue({
      workspace: createWorkspaceDto({ name: "Updated" }),
    });
    leaveApiWorkspaceMock.mockResolvedValue({ success: true });

    const { createWorkspace, leaveWorkspace, updateWorkspace } = await import("./workspace.service");

    await expect(createWorkspace({ name: "Family", slug: "family" })).resolves.toMatchObject({
      data: expect.objectContaining({ id: "workspace-1" }),
    });
    await expect(updateWorkspace("workspace-1", { name: "Updated" })).resolves.toEqual({
      data: {
        id: "workspace-1",
        name: "Updated",
        icon: null,
        baseCurrency: "BYN",
        ownerId: "user-1",
      },
    });
    await expect(leaveWorkspace("workspace-1")).resolves.toEqual({ success: true });
    expect(revalidateWorkspaceRoutesMock).toHaveBeenCalledTimes(3);
  });

  it("normalizes API failures into action errors", async () => {
    listApiWorkspacesMock.mockRejectedValue(new Error("No session"));

    const { getWorkspaces } = await import("./workspace.service");

    await expect(getWorkspaces()).resolves.toEqual({ error: "No session" });
  });
});
