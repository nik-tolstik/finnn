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
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  authSession: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  workspaceMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  workspaceInvite: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspaceInvite: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

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
    emailService.sendInviteEmail.mockResolvedValue({ success: true });
  });

  afterAll(async () => {
    await app.close();
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
