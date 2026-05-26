import { beforeEach, describe, expect, it, vi } from "vitest";

const createApiWorkspaceMock = vi.fn();
const getApiWorkspaceMembersMock = vi.fn();
const getApiWorkspaceSummaryMock = vi.fn();
const leaveApiWorkspaceMock = vi.fn();
const listApiWorkspacesMock = vi.fn();
const updateApiWorkspaceMock = vi.fn();

vi.mock("@/shared/api/generated/workspaces/workspaces", () => ({
  createWorkspace: createApiWorkspaceMock,
  getWorkspaceMembers: getApiWorkspaceMembersMock,
  getWorkspaceSummary: getApiWorkspaceSummaryMock,
  leaveWorkspace: leaveApiWorkspaceMock,
  listWorkspaces: listApiWorkspacesMock,
  updateWorkspace: updateApiWorkspaceMock,
}));

const requestOptions = {
  cache: "no-store" as const,
  headers: { cookie: "finnn_session=token" },
};

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

describe("workspace.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps listWorkspaces response to the existing ActionResult workspace list shape", async () => {
    listApiWorkspacesMock.mockResolvedValue({
      workspaces: [createWorkspaceDto({ icon: "Wallet" })],
    });

    const { getWorkspaces } = await import("./workspace.api");
    const result = await getWorkspaces(requestOptions);

    expect(listApiWorkspacesMock).toHaveBeenCalledWith(requestOptions);
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

    const { getWorkspaceMembers, getWorkspaceSummary } = await import("./workspace.api");

    await expect(getWorkspaceSummary("workspace-1", requestOptions)).resolves.toEqual({
      data: {
        id: "workspace-1",
        name: "Family",
        icon: "Wallet",
        baseCurrency: "BYN",
        ownerId: "user-1",
      },
    });
    expect(getApiWorkspaceSummaryMock).toHaveBeenCalledWith("workspace-1", requestOptions);

    await expect(getWorkspaceMembers("workspace-1", requestOptions)).resolves.toEqual({
      data: [
        {
          id: "user-1",
          name: "Finn",
          email: "finn@example.com",
          image: null,
        },
      ],
    });
    expect(getApiWorkspaceMembersMock).toHaveBeenCalledWith("workspace-1", requestOptions);
  });

  it("maps workspace mutation responses without requiring server actions", async () => {
    createApiWorkspaceMock.mockResolvedValue({
      workspace: createWorkspaceDto(),
    });
    updateApiWorkspaceMock.mockResolvedValue({
      workspace: createWorkspaceDto({ name: "Updated" }),
    });
    leaveApiWorkspaceMock.mockResolvedValue({ success: true });

    const { createWorkspace, leaveWorkspace, updateWorkspace } = await import("./workspace.api");

    await expect(createWorkspace({ name: "Family", slug: "family" })).resolves.toMatchObject({
      data: expect.objectContaining({ id: "workspace-1" }),
    });
    expect(createApiWorkspaceMock).toHaveBeenCalledWith({ name: "Family", slug: "family" }, undefined);

    await expect(updateWorkspace("workspace-1", { name: "Updated" })).resolves.toEqual({
      data: {
        id: "workspace-1",
        name: "Updated",
        icon: null,
        baseCurrency: "BYN",
        ownerId: "user-1",
      },
    });
    expect(updateApiWorkspaceMock).toHaveBeenCalledWith("workspace-1", { name: "Updated" }, undefined);

    await expect(leaveWorkspace("workspace-1")).resolves.toEqual({ success: true });
    expect(leaveApiWorkspaceMock).toHaveBeenCalledWith("workspace-1", undefined);
  });

  it("normalizes API failures into action errors", async () => {
    listApiWorkspacesMock.mockRejectedValue(new Error("No session"));

    const { getWorkspaces } = await import("./workspace.api");

    await expect(getWorkspaces()).resolves.toEqual({ error: "No session" });
  });
});
