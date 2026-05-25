import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModule } from "../src/auth/auth.module";
import { AUTH_COOKIE_NAME, hashSessionToken } from "../src/auth/session-cookie";
import { EmailService } from "../src/email/email.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pendingRegistration: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  authSession: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pendingRegistration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    authSession: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

describe("Auth API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  const emailService = {
    sendVerificationEmail: vi.fn(),
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
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
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.pendingRegistration.findUnique.mockResolvedValue(null);
    prisma.authSession.deleteMany.mockResolvedValue({ count: 0 });
    emailService.sendVerificationEmail.mockResolvedValue({ success: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a pending user with a hashed password and sends verification email", async () => {
    prisma.pendingRegistration.create.mockImplementation(async ({ data }) => ({
      id: "pending-1",
      ...data,
    }));

    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "secret123" })
      .expect(201)
      .expect({ success: true });

    const createCall = prisma.pendingRegistration.create.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
    });
    expect(createCall.data.token).toHaveLength(64);
    expect(createCall.data.password).not.toBe("secret123");
    await expect(bcrypt.compare("secret123", createCall.data.password)).resolves.toBe(true);
    expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith("ada@example.com", createCall.data.token, "Ada");
  });

  it("rejects an existing user during registration", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      password: "hash",
      emailVerified: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "secret123" })
      .expect(409);

    expect(response.body.message).toBe("Пользователь с таким email уже существует");
    expect(prisma.pendingRegistration.create).not.toHaveBeenCalled();
  });

  it("deletes expired pending registrations before starting registration again", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue({
      id: "expired-pending",
      email: "ada@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    prisma.pendingRegistration.create.mockImplementation(async ({ data }) => ({
      id: "pending-2",
      ...data,
    }));

    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "secret123" })
      .expect(201);

    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { id: "expired-pending" } });
    expect(prisma.pendingRegistration.create).toHaveBeenCalled();
  });

  it("rolls back pending registration when verification email fails", async () => {
    prisma.pendingRegistration.create.mockResolvedValue({
      id: "pending-1",
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
      token: "token",
      expiresAt: new Date(Date.now() + 1000),
    });
    emailService.sendVerificationEmail.mockResolvedValue({ error: "SMTP unavailable" });

    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Ada", email: "ada@example.com", password: "secret123" })
      .expect(503);

    expect(response.body.message).toContain("Не удалось отправить письмо подтверждения");
    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { id: "pending-1" } });
  });

  it("verifies email by creating a user and deleting the pending registration", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue({
      id: "pending-1",
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
      token: "token",
      expiresAt: new Date(Date.now() + 1000),
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1" });

    await request(app.getHttpServer())
      .post("/auth/verify-email/token")
      .expect(200)
      .expect({ success: true, userId: "user-1" });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Ada",
        email: "ada@example.com",
        password: "hash",
        emailVerified: expect.any(Date),
      }),
    });
    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { id: "pending-1" } });
  });

  it("rejects unverified login when a pending registration still exists", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      password: await bcrypt.hash("secret123", 10),
      emailVerified: null,
    });
    prisma.pendingRegistration.findUnique.mockResolvedValue({ id: "pending-1" });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "ada@example.com", password: "secret123" })
      .expect(403);

    expect(response.body.message).toContain("Email не подтвержден");
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("issues an HTTP-only session cookie on successful login", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      password: await bcrypt.hash("secret123", 10),
      emailVerified: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "ada@example.com", password: "secret123" })
      .expect(200);

    expect(response.body.user).toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
    });
    expect(response.headers["set-cookie"][0]).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");

    const createCall = prisma.authSession.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.tokenHash).toHaveLength(64);
  });

  it("returns the current session user from the auth cookie", async () => {
    const token = "session-token";
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
    });

    await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${token}`)
      .expect(200)
      .expect({
        authenticated: true,
        user: {
          id: "user-1",
          email: "ada@example.com",
          name: "Ada",
          image: null,
        },
      });

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashSessionToken(token),
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { userId: true },
    });
  });

  it("requires a valid session to update the current user", async () => {
    await request(app.getHttpServer()).patch("/auth/user").send({ name: "Ada Lovelace", image: null }).expect(401);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
