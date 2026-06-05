import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModule } from "../src/auth/auth.module";
import { AUTH_COOKIE_NAME, hashSessionToken } from "../src/auth/session-cookie";
import { TelegramOidcClient } from "../src/auth/telegram-oidc.client";
import { TELEGRAM_STATE_COOKIE_NAME } from "../src/auth/telegram-state-cookie";
import { EmailService } from "../src/email/email.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  authIdentity: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  pendingRegistration: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  pendingEmailVerification: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  authSession: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  const prisma = {
    $transaction: vi.fn(async (callback) => callback(prisma)),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    authIdentity: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    pendingRegistration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    pendingEmailVerification: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    authSession: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  };
  return prisma;
}

const unlinkedTelegram = {
  linked: false,
  username: null,
  displayName: null,
  photoUrl: null,
};

const linkedTelegram = {
  linked: true,
  username: "ada",
  displayName: "Ada",
  photoUrl: "https://t.me/i/userpic/320/ada.jpg",
};

function getSetCookieValues(response: request.Response): string[] {
  const value = response.headers["set-cookie"];
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function getCookiePair(setCookie: string, name: string): string {
  const cookie = setCookie
    .split(";")
    .find((part) => part.trim().startsWith(`${name}=`))
    ?.trim();
  if (!cookie) throw new Error(`Missing ${name} cookie`);
  return cookie;
}

describe("Auth API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  const emailService = {
    sendVerificationEmail: vi.fn(),
  };
  const telegramOidcClient = {
    exchangeCodeForClaims: vi.fn(),
    getAuthorizationUrl: vi.fn(),
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
      .overrideProvider(TelegramOidcClient)
      .useValue(telegramOidcClient)
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_COOKIE_SAME_SITE: "lax",
      API_COOKIE_SECURE: "false",
    } as NodeJS.ProcessEnv);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_AUTH_STATE_SECRET = "test-telegram-state-secret";
    process.env.WEB_APP_URL = "http://localhost:3000";
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUniqueOrThrow.mockRejectedValue(new Error("User not found"));
    prisma.authIdentity.findUnique.mockResolvedValue(null);
    prisma.authIdentity.create.mockResolvedValue({ id: "identity-1" });
    prisma.authIdentity.update.mockResolvedValue({ id: "identity-1" });
    prisma.authIdentity.upsert.mockResolvedValue({ id: "identity-1" });
    prisma.authIdentity.delete.mockResolvedValue({ id: "identity-1" });
    prisma.pendingRegistration.findUnique.mockResolvedValue(null);
    prisma.pendingEmailVerification.findUnique.mockResolvedValue(null);
    prisma.pendingEmailVerification.upsert.mockResolvedValue({ id: "pending-email-1" });
    prisma.pendingEmailVerification.delete.mockResolvedValue({ id: "pending-email-1" });
    prisma.authSession.deleteMany.mockResolvedValue({ count: 0 });
    prisma.authSession.count.mockResolvedValue(0);
    emailService.sendVerificationEmail.mockResolvedValue({ success: true });
    telegramOidcClient.getAuthorizationUrl.mockImplementation(
      ({ state }) => `https://oauth.telegram.org/auth?state=${state}`
    );
    telegramOidcClient.exchangeCodeForClaims.mockResolvedValue({
      sub: "telegram-1",
      name: "Ada",
      preferred_username: "ada",
      picture: "https://t.me/i/userpic/320/ada.jpg",
    });
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
    prisma.user.findFirst.mockResolvedValue({
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
    prisma.user.findFirst.mockResolvedValue(null);
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

  it("requests email verification for an existing Telegram-only user", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: null,
        name: "Ada",
        image: null,
        authIdentities: [{ provider: "telegram", username: "ada", displayName: "Ada", photoUrl: null }],
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: null,
        name: "Ada",
        emailVerified: null,
      });

    await request(app.getHttpServer())
      .post("/auth/email")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ email: "ada@example.com" })
      .expect(200)
      .expect({ success: true });

    const upsertCall = prisma.pendingEmailVerification.upsert.mock.calls[0][0];
    expect(upsertCall).toMatchObject({
      where: { userId: "user-1" },
      create: expect.objectContaining({
        userId: "user-1",
        email: "ada@example.com",
      }),
    });
    expect(upsertCall.create.token).toHaveLength(64);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith("ada@example.com", upsertCall.create.token, "Ada");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "ada@example.com",
        emailVerified: null,
      },
    });
  });

  it("verifies an email added by an existing user", async () => {
    prisma.pendingEmailVerification.findUnique.mockResolvedValue({
      id: "pending-email-1",
      userId: "user-1",
      email: "ada@example.com",
      token: "email-token",
      expiresAt: new Date(Date.now() + 1000),
    });

    await request(app.getHttpServer())
      .post("/auth/verify-email/email-token")
      .expect(200)
      .expect({ success: true, userId: "user-1" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "ada@example.com",
        emailVerified: expect.any(Date),
      },
    });
    expect(prisma.pendingEmailVerification.delete).toHaveBeenCalledWith({ where: { id: "pending-email-1" } });
  });

  it("rejects unverified login when a pending registration still exists", async () => {
    prisma.user.findFirst.mockResolvedValue({
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
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      password: await bcrypt.hash("secret123", 10),
      emailVerified: new Date(),
      authIdentities: [],
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
      telegram: unlinkedTelegram,
    });
    expect(response.headers["set-cookie"][0]).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");

    const createCall = prisma.authSession.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.tokenHash).toHaveLength(64);
    expect(createCall.data.revokedAt).toBeNull();
  });

  it("keeps local SameSite=None cookies browser-acceptable by falling back to Lax without Secure", async () => {
    process.env.API_COOKIE_SAME_SITE = "none";
    process.env.API_COOKIE_SECURE = "false";
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      password: await bcrypt.hash("secret123", 10),
      emailVerified: new Date(),
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "ada@example.com", password: "secret123" })
      .expect(200);

    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"][0]).not.toContain("Secure");

    process.env.API_COOKIE_SAME_SITE = "lax";
  });

  it("returns the current session user from the auth cookie", async () => {
    const token = "session-token";
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
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
          telegram: unlinkedTelegram,
        },
      });

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashSessionToken(token),
        OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
        expiresAt: { gt: expect.any(Date) },
      },
      select: { userId: true },
    });
  });

  it("uses the newest duplicated session cookie value when browsers send stale and fresh cookies together", async () => {
    const staleToken = "stale-session-token";
    const freshToken = "fresh-session-token";
    prisma.authSession.findFirst.mockImplementation(async ({ where }) =>
      where.tokenHash === hashSessionToken(freshToken) ? { userId: "user-1" } : null
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${staleToken}; ${AUTH_COOKIE_NAME}=${freshToken}`)
      .expect(200)
      .expect({
        authenticated: true,
        user: {
          id: "user-1",
          email: "ada@example.com",
          name: "Ada",
          image: null,
          telegram: unlinkedTelegram,
        },
      });

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashSessionToken(freshToken),
        OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
        expiresAt: { gt: expect.any(Date) },
      },
      select: { userId: true },
    });
  });

  it("still authenticates duplicate session cookies when browser ordering puts the fresh cookie first", async () => {
    const freshToken = "fresh-session-token";
    const staleToken = "stale-session-token";
    prisma.authSession.findFirst.mockImplementation(async ({ where }) =>
      where.tokenHash === hashSessionToken(freshToken) ? { userId: "user-1" } : null
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${freshToken}; ${AUTH_COOKIE_NAME}=${staleToken}`)
      .expect(200)
      .expect({
        authenticated: true,
        user: {
          id: "user-1",
          email: "ada@example.com",
          name: "Ada",
          image: null,
          telegram: unlinkedTelegram,
        },
      });
  });

  it("starts Telegram authentication with a temporary state cookie", async () => {
    const response = await request(app.getHttpServer()).get("/auth/telegram/start?returnTo=/dashboard").expect(302);

    expect(response.headers.location).toContain("https://oauth.telegram.org/auth?state=");
    expect(getSetCookieValues(response)[0]).toContain(`${TELEGRAM_STATE_COOKIE_NAME}=`);
    expect(getSetCookieValues(response)[0]).toContain("HttpOnly");
  });

  it("signs in with an existing linked Telegram identity", async () => {
    const startResponse = await request(app.getHttpServer())
      .get("/auth/telegram/start?returnTo=/dashboard")
      .expect(302);
    const state = new URL(startResponse.headers.location).searchParams.get("state");
    const stateCookie = getCookiePair(getSetCookieValues(startResponse)[0], TELEGRAM_STATE_COOKIE_NAME);

    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada",
          photoUrl: "https://t.me/i/userpic/320/ada.jpg",
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/auth/telegram/callback?code=telegram-code&state=${state}`)
      .set("Cookie", stateCookie)
      .expect(302);

    expect(response.headers.location).toBe("http://localhost:3000/dashboard");
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "telegram-1",
        },
      },
      data: {
        username: "ada",
        displayName: "Ada",
        photoUrl: "https://t.me/i/userpic/320/ada.jpg",
      },
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", revokedAt: null }),
    });
    expect(getSetCookieValues(response).join("; ")).toContain(`${AUTH_COOKIE_NAME}=`);
  });

  it("creates a nullable-email user on first Telegram login", async () => {
    const startResponse = await request(app.getHttpServer()).get("/auth/telegram/start").expect(302);
    const state = new URL(startResponse.headers.location).searchParams.get("state");
    const stateCookie = getCookiePair(getSetCookieValues(startResponse)[0], TELEGRAM_STATE_COOKIE_NAME);
    prisma.user.create.mockResolvedValue({ id: "user-telegram" });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-telegram",
      email: null,
      name: "Ada",
      image: "https://t.me/i/userpic/320/ada.jpg",
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada",
          photoUrl: "https://t.me/i/userpic/320/ada.jpg",
        },
      ],
    });

    await request(app.getHttpServer())
      .get(`/auth/telegram/callback?code=telegram-code&state=${state}`)
      .set("Cookie", stateCookie)
      .expect(302);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: null,
        name: "Ada",
        image: "https://t.me/i/userpic/320/ada.jpg",
      },
      select: { id: true },
    });
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "telegram",
        providerUserId: "telegram-1",
      }),
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-telegram" }),
    });
  });

  it("relays non-local Telegram callback parameters to the local callback during development", async () => {
    const response = await request(app.getHttpServer())
      .get("/auth/telegram/callback?code=telegram-code&state=telegram-state")
      .set("Host", "unscarce-shalonda-uninfectiously.ngrok-free.dev")
      .expect(302);

    expect(response.headers.location).toBe(
      "http://localhost:4000/auth/telegram/callback?code=telegram-code&state=telegram-state"
    );
    expect(telegramOidcClient.exchangeCodeForClaims).not.toHaveBeenCalled();
  });

  it("links Telegram for the authenticated user", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });
    const startResponse = await request(app.getHttpServer())
      .get("/auth/telegram/link/start?returnTo=/dashboard")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(302);
    const state = new URL(startResponse.headers.location).searchParams.get("state");
    const stateCookie = getCookiePair(getSetCookieValues(startResponse)[0], TELEGRAM_STATE_COOKIE_NAME);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada",
          photoUrl: "https://t.me/i/userpic/320/ada.jpg",
        },
      ],
    });

    await request(app.getHttpServer())
      .get(`/auth/telegram/callback?code=telegram-code&state=${state}`)
      .set("Cookie", stateCookie)
      .expect(302);

    expect(prisma.authIdentity.upsert).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "telegram-1",
        },
      },
      update: {
        username: "ada",
        displayName: "Ada",
        photoUrl: "https://t.me/i/userpic/320/ada.jpg",
      },
      create: expect.objectContaining({
        provider: "telegram",
        providerUserId: "telegram-1",
      }),
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects linking a Telegram identity already linked to another user", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });
    const startResponse = await request(app.getHttpServer())
      .get("/auth/telegram/link/start")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(302);
    const state = new URL(startResponse.headers.location).searchParams.get("state");
    const stateCookie = getCookiePair(getSetCookieValues(startResponse)[0], TELEGRAM_STATE_COOKIE_NAME);
    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "user-2" });

    const response = await request(app.getHttpServer())
      .get(`/auth/telegram/callback?code=telegram-code&state=${state}`)
      .set("Cookie", stateCookie)
      .expect(409);

    expect(response.body.message).toBe("Этот Telegram аккаунт уже подключен к другому пользователю");
  });

  it("unlinks Telegram when another sign-in method remains", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        authIdentities: [{ provider: "telegram", username: "ada", displayName: "Ada", photoUrl: null }],
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        password: "hash",
        emailVerified: new Date(),
        authIdentities: [{ id: "identity-1", provider: "telegram" }],
      });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .delete("/auth/telegram/link")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(prisma.authIdentity.delete).toHaveBeenCalledWith({ where: { id: "identity-1" } });
    expect(response.body.user.telegram).toEqual(unlinkedTelegram);
  });

  it("blocks Telegram unlink when it would remove the last sign-in method", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: null,
        name: "Ada",
        image: null,
        authIdentities: [{ provider: "telegram", username: "ada", displayName: "Ada", photoUrl: null }],
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: null,
        password: null,
        emailVerified: null,
        authIdentities: [{ id: "identity-1", provider: "telegram" }],
      });

    const response = await request(app.getHttpServer())
      .delete("/auth/telegram/link")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(response.body.message).toContain("Нельзя отключить Telegram");
    expect(prisma.authIdentity.delete).not.toHaveBeenCalled();
  });

  it("rejects an invalid Telegram state before token exchange", async () => {
    const response = await request(app.getHttpServer())
      .get("/auth/telegram/callback?code=telegram-code&state=bad-state")
      .set("Cookie", `${TELEGRAM_STATE_COOKIE_NAME}=invalid`)
      .expect(401);

    expect(response.body.message).toBe("Telegram authentication state is invalid");
    expect(telegramOidcClient.exchangeCodeForClaims).not.toHaveBeenCalled();
  });

  it("returns nullable-email users from valid sessions", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-telegram" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-telegram",
      email: null,
      name: "Ada",
      image: null,
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada",
          photoUrl: "https://t.me/i/userpic/320/ada.jpg",
        },
      ],
    });

    await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200)
      .expect({
        authenticated: true,
        user: {
          id: "user-telegram",
          email: null,
          name: "Ada",
          image: null,
          telegram: linkedTelegram,
        },
      });
  });

  it("requires a valid session to update the current user", async () => {
    await request(app.getHttpServer()).patch("/auth/user").send({ name: "Ada Lovelace", image: null }).expect(401);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
