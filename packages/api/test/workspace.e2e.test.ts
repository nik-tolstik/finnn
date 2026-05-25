import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME, hashSessionToken } from "../src/auth/session-cookie";
import { EmailService } from "../src/email/email.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { WorkspaceModule } from "../src/workspace/workspace.module";

type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  authSession: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  workspaceMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  category: {
    createMany: ReturnType<typeof vi.fn>;
  };
  workspaceInvite: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  const mock = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      createMany: vi.fn(),
    },
    workspaceInvite: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

const workspaceOwner = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

const workspaceMember = {
  role: "member",
  user: {
    id: "user-2",
    email: "grace@example.com",
    name: "Grace",
    image: "avatar-02",
  },
};

function createWorkspaceRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "workspace-1",
    name: "Shared budget",
    slug: "shared-budget",
    icon: "wallet",
    baseCurrency: "BYN",
    ownerId: currentUser.id,
    createdAt: new Date("2026-05-25T00:00:00.000Z"),
    updatedAt: new Date("2026-05-25T00:00:00.000Z"),
    owner: workspaceOwner,
    members: [{ role: "owner", user: workspaceOwner }, workspaceMember],
    _count: {
      members: 2,
    },
    ...overrides,
  };
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockImplementation(async ({ where }) => {
    if (where.id === currentUser.id) return currentUser;
    if (where.email === "grace@example.com") return { id: "user-2" };
    return null;
  });
}

describe("Workspace API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  const emailService = {
    sendInviteEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [WorkspaceModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(EmailService)
      .useValue(emailService)
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_COOKIE_SAME_SITE: "lax",
      API_COOKIE_SECURE: "false",
    } as NodeJS.ProcessEnv);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.authSession.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue({
      ownerId: currentUser.id,
      name: "Shared budget",
    });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.workspaceInvite.create.mockImplementation(async ({ data }) => ({
      id: "invite-1",
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
      ...data,
    }));
    prisma.workspaceInvite.delete.mockResolvedValue({});
    prisma.workspace.findMany.mockResolvedValue([]);
    prisma.workspace.create.mockResolvedValue(createWorkspaceRecord());
    prisma.workspace.update.mockResolvedValue(createWorkspaceRecord({ name: "Updated budget" }));
    prisma.workspace.delete.mockResolvedValue({});
    prisma.workspaceMember.delete.mockResolvedValue({});
    prisma.category.createMany.mockResolvedValue({ count: 14 });
    emailService.sendInviteEmail.mockResolvedValue({ success: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a workspace with default categories for the authenticated user", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockImplementation(async ({ where, select }) => {
      if (where.slug === "shared-budget") return null;
      if (select?.ownerId) return { ownerId: currentUser.id };
      return createWorkspaceRecord();
    });
    prisma.workspace.create.mockResolvedValue(createWorkspaceRecord());

    const response = await request(app.getHttpServer())
      .post("/workspaces")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Shared budget", slug: "shared-budget" })
      .expect(201);

    expect(response.body.workspace).toMatchObject({
      id: "workspace-1",
      name: "Shared budget",
      slug: "shared-budget",
      baseCurrency: "BYN",
      ownerId: "user-1",
      membersCount: 2,
    });
    expect(prisma.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Shared budget",
          slug: "shared-budget",
          baseCurrency: "BYN",
          ownerId: "user-1",
        }),
      })
    );
    expect(prisma.category.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: "Продукты", type: "expense", workspaceId: "workspace-1" }),
        expect.objectContaining({ name: "Зарплата", type: "income", workspaceId: "workspace-1" }),
      ]),
    });
  });

  it("lists workspaces accessible to the authenticated user", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findMany.mockResolvedValue([createWorkspaceRecord()]);

    const response = await request(app.getHttpServer())
      .get("/workspaces")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body).toEqual({
      workspaces: [
        {
          id: "workspace-1",
          name: "Shared budget",
          slug: "shared-budget",
          icon: "wallet",
          baseCurrency: "BYN",
          ownerId: "user-1",
          membersCount: 2,
          owner: workspaceOwner,
        },
      ],
    });
    expect(prisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ ownerId: "user-1" }, { members: { some: { userId: "user-1" } } }],
        },
      })
    );
  });

  it("returns workspace summary for authorized members", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue(createWorkspaceRecord({ ownerId: "owner-1" }));
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: "member" });

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/summary")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.workspace).toMatchObject({
      id: "workspace-1",
      name: "Shared budget",
      membersCount: 2,
    });
  });

  it("returns de-duplicated workspace members including the owner", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue(createWorkspaceRecord());

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/members")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.members).toEqual([
      {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com",
        image: null,
        role: "owner",
      },
      {
        id: "user-2",
        name: "Grace",
        email: "grace@example.com",
        image: "avatar-02",
        role: "member",
      },
    ]);
  });

  it("updates a workspace for admins", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockImplementation(async ({ where, select }) => {
      if (select?.ownerId) return { ownerId: currentUser.id };
      if (where.slug === "updated-budget") return null;
      return createWorkspaceRecord();
    });
    prisma.workspace.update.mockResolvedValue(
      createWorkspaceRecord({ icon: null, name: "Updated budget", slug: "updated-budget" })
    );

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Updated budget", slug: "updated-budget", icon: null })
      .expect(200);

    expect(response.body.workspace).toMatchObject({
      id: "workspace-1",
      name: "Updated budget",
      slug: "updated-budget",
      icon: null,
    });
    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workspace-1" },
        data: { name: "Updated budget", slug: "updated-budget", icon: null },
      })
    );
  });

  it("prevents owners from leaving their own workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue(createWorkspaceRecord());

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/leave")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(response.body.message).toBe("Создатель рабочего стола не может покинуть его");
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
  });

  it("lets members leave a workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue(createWorkspaceRecord({ ownerId: "owner-1" }));
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: "member-1", role: "member" });

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/leave")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200)
      .expect({ success: true });

    expect(prisma.workspaceMember.delete).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-1",
        },
      },
    });
  });

  it("lets owners delete a workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue(createWorkspaceRecord());

    await request(app.getHttpServer())
      .delete("/workspaces/workspace-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.workspace.delete).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
    });
  });

  it("lets workspace owners create invites and sends the invite email from the API", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/invites")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ email: "grace@example.com", expiresInDays: 7 })
      .expect(201);

    expect(response.body.invite).toMatchObject({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "grace@example.com",
    });
    expect(response.body.invite.token).toHaveLength(64);
    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashSessionToken("session-token"),
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { userId: true },
    });
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(
      "grace@example.com",
      response.body.invite.token,
      "Shared budget"
    );
  });

  it("denies invite creation when a member does not have the admin role", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({
      ownerId: "owner-1",
      name: "Shared budget",
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: "member" });

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/invites")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ email: "grace@example.com", expiresInDays: 7 })
      .expect(403);

    expect(response.body.message).toBe("Доступ запрещён");
    expect(prisma.workspaceInvite.create).not.toHaveBeenCalled();
  });

  it("rolls back invite creation when the invite email cannot be sent", async () => {
    mockAuthenticatedSession(prisma);
    emailService.sendInviteEmail.mockResolvedValue({ error: "SMTP unavailable" });

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/invites")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ email: "grace@example.com", expiresInDays: 7 })
      .expect(503);

    expect(response.body.message).toContain("Не удалось отправить приглашение");
    expect(prisma.workspaceInvite.delete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });

  it("returns public invite preview data", async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "ada@example.com",
      token: "invite-token",
      expiresAt: new Date(Date.now() + 1000),
      workspace: {
        id: "workspace-1",
        name: "Shared budget",
      },
    });

    const response = await request(app.getHttpServer()).get("/workspace-invites/invite-token").expect(200);

    expect(response.body).toEqual({
      invite: {
        email: "ada@example.com",
        workspaceName: "Shared budget",
        workspaceId: "workspace-1",
        expiresAt: expect.any(String),
      },
    });
  });

  it("requires authentication before accepting an invite", async () => {
    await request(app.getHttpServer()).post("/workspace-invites/invite-token/accept").expect(401);

    expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
  });

  it("accepts an invite for the authenticated user's email", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "ada@example.com",
      token: "invite-token",
      expiresAt: new Date(Date.now() + 1000),
      workspace: {
        id: "workspace-1",
        name: "Shared budget",
      },
    });

    await request(app.getHttpServer())
      .post("/workspace-invites/invite-token/accept")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200)
      .expect({ success: true, workspaceId: "workspace-1" });

    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        userId: "user-1",
        role: "member",
      },
    });
    expect(prisma.workspaceInvite.delete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });

  it("rejects invite acceptance when the authenticated email does not match", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      workspaceId: "workspace-1",
      email: "grace@example.com",
      token: "invite-token",
      expiresAt: new Date(Date.now() + 1000),
      workspace: {
        id: "workspace-1",
        name: "Shared budget",
      },
    });

    const response = await request(app.getHttpServer())
      .post("/workspace-invites/invite-token/accept")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);

    expect(response.body.message).toBe("Email приглашения не совпадает с вашим аккаунтом");
    expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
  });
});
