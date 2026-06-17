import { createHmac } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModule } from "../src/auth/auth.module";
import { AUTH_COOKIE_NAME, hashSessionToken } from "../src/auth/session-cookie";
import { TelegramOidcClient } from "../src/auth/telegram-oidc.client";
import { TELEGRAM_STATE_COOKIE_NAME } from "../src/auth/telegram-state-cookie";
import { AvatarStorageService } from "../src/avatar/avatar-storage.service";
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
    updateMany: ReturnType<typeof vi.fn>;
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
      updateMany: vi.fn(),
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

function createTelegramMiniAppInitData(
  input: {
    user?: Record<string, unknown>;
    authDate?: number;
    botToken?: string;
    hash?: string;
    includeUser?: boolean;
  } = {}
): string {
  const params = new URLSearchParams();
  params.set("auth_date", String(input.authDate ?? Math.floor(Date.now() / 1000)));
  params.set("query_id", "test-query-id");
  if (input.includeUser !== false) {
    params.set(
      "user",
      JSON.stringify(
        input.user ?? {
          id: 123456789,
          first_name: "Ada",
          last_name: "Lovelace",
          username: "ada",
          photo_url: "https://t.me/i/userpic/320/ada.jpg",
        }
      )
    );
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(input.botToken ?? "test-bot-token")
    .digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", input.hash ?? hash);
  return params.toString();
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
  const avatarStorage = {
    upload: vi.fn(),
    delete: vi.fn(),
    getReadUrl: vi.fn(),
  };

  const pngAvatar = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

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
      .overrideProvider(AvatarStorageService)
      .useValue(avatarStorage)
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
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS = "86400";
    process.env.WEB_APP_URL = "http://localhost:3000";
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUniqueOrThrow.mockRejectedValue(new Error("User not found"));
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
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
      sub: "14040056584244839695",
      id: "455466975",
      name: "Ada",
      preferred_username: "ada",
      picture: "https://t.me/i/userpic/320/ada.jpg",
    });
    avatarStorage.upload.mockResolvedValue("avatars/user-1/new-avatar.png");
    avatarStorage.delete.mockResolvedValue(undefined);
    avatarStorage.getReadUrl.mockResolvedValue("https://storage.example.com/presigned-avatar");
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
    const linkedUser = {
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
    };
    prisma.user.findUnique.mockResolvedValue(linkedUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(linkedUser);

    const response = await request(app.getHttpServer())
      .get(`/auth/telegram/callback?code=telegram-code&state=${state}`)
      .set("Cookie", stateCookie)
      .expect(302);

    expect(response.headers.location).toBe("http://localhost:3000/dashboard");
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "455466975",
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
        providerUserId: "455466975",
      }),
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-telegram" }),
    });
  });

  it("rejects missing Telegram Mini App initData", async () => {
    await request(app.getHttpServer()).post("/auth/telegram-mini/session").send({}).expect(400);

    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects Telegram Mini App initData with an invalid hash", async () => {
    const initData = createTelegramMiniAppInitData({
      user: { id: 123, first_name: "Ada", username: "ada" },
      hash: "bad-hash",
    });

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(401);

    expect(response.body.message).toBe("Telegram Mini App init data hash is invalid");
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects stale Telegram Mini App initData", async () => {
    process.env.TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS = "60";
    const initData = createTelegramMiniAppInitData({
      user: { id: 123, first_name: "Ada", username: "ada" },
      authDate: Math.floor(Date.now() / 1000) - 120,
    });

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(401);

    expect(response.body.message).toBe("Telegram Mini App init data has expired");
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects Telegram Mini App initData without a user", async () => {
    const initData = createTelegramMiniAppInitData({ includeUser: false });

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(400);

    expect(response.body.message).toBe("Telegram Mini App init data user is required");
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("creates a session for an existing Telegram Mini App identity", async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 123,
        first_name: "Ada",
        last_name: "Lovelace",
        username: "ada",
        photo_url: "https://t.me/i/userpic/320/new-ada.jpg",
      },
    });
    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "user-1" });
    const linkedUser = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://t.me/i/userpic/320/new-ada.jpg",
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada Lovelace",
          photoUrl: "https://t.me/i/userpic/320/new-ada.jpg",
        },
      ],
    };
    prisma.user.findUnique.mockResolvedValue(linkedUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(linkedUser);

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(200);

    expect(response.body.user).toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://t.me/i/userpic/320/new-ada.jpg",
      telegram: {
        linked: true,
        username: "ada",
        displayName: "Ada Lovelace",
        photoUrl: "https://t.me/i/userpic/320/new-ada.jpg",
      },
    });
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "123",
        },
      },
      data: {
        username: "ada",
        displayName: "Ada Lovelace",
        photoUrl: "https://t.me/i/userpic/320/new-ada.jpg",
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", image: null },
      data: { image: "https://t.me/i/userpic/320/new-ada.jpg" },
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", revokedAt: null }),
    });
    expect(getSetCookieValues(response)[0]).toContain(`${AUTH_COOKIE_NAME}=`);
  });

  it("rejects a stale Telegram Mini App identity whose user no longer exists", async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 123,
        first_name: "Ada",
        last_name: "Lovelace",
        username: "ada",
        photo_url: "https://t.me/i/userpic/320/ada.jpg",
      },
    });
    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "missing-user" });
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(409);

    expect(response.body.message).toBe(
      "Telegram аккаунт привязан к несуществующему пользователю. Переподключите Telegram."
    );
    expect(prisma.authIdentity.delete).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("creates a nullable-email user on first Telegram Mini App session", async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 456,
        first_name: "Grace",
        last_name: "Hopper",
        username: "grace",
        photo_url: "https://t.me/i/userpic/320/grace.jpg",
      },
    });
    prisma.user.create.mockResolvedValue({ id: "user-telegram-mini" });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-telegram-mini",
      email: null,
      name: "Grace Hopper",
      image: "https://t.me/i/userpic/320/grace.jpg",
      authIdentities: [
        {
          provider: "telegram",
          username: "grace",
          displayName: "Grace Hopper",
          photoUrl: "https://t.me/i/userpic/320/grace.jpg",
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(200);

    expect(response.body.user.email).toBeNull();
    expect(response.body.user.telegram.linked).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: null,
        name: "Grace Hopper",
        image: "https://t.me/i/userpic/320/grace.jpg",
      },
      select: { id: true },
    });
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "telegram",
        providerUserId: "456",
        username: "grace",
        displayName: "Grace Hopper",
        photoUrl: "https://t.me/i/userpic/320/grace.jpg",
      }),
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-telegram-mini" }),
    });
  });

  it("updates Telegram Mini App profile metadata for an existing identity", async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 123,
        first_name: "Ada",
        last_name: "Byron",
        username: "ada_new",
        photo_url: "https://t.me/i/userpic/320/ada-new.jpg",
      },
    });
    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "user-1" });
    const linkedUser = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://t.me/i/userpic/320/ada-new.jpg",
      authIdentities: [
        {
          provider: "telegram",
          username: "ada_new",
          displayName: "Ada Byron",
          photoUrl: "https://t.me/i/userpic/320/ada-new.jpg",
        },
      ],
    };
    prisma.user.findUnique.mockResolvedValue(linkedUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(linkedUser);

    await request(app.getHttpServer()).post("/auth/telegram-mini/session").send({ initData }).expect(200);

    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "123",
        },
      },
      data: {
        username: "ada_new",
        displayName: "Ada Byron",
        photoUrl: "https://t.me/i/userpic/320/ada-new.jpg",
      },
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
          providerUserId: "455466975",
        },
      },
      update: {
        username: "ada",
        displayName: "Ada",
        photoUrl: "https://t.me/i/userpic/320/ada.jpg",
      },
      create: expect.objectContaining({
        provider: "telegram",
        providerUserId: "455466975",
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

  it("preserves the current avatar when profile update omits image", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "/avatars/animals/cat-01.svg",
      authIdentities: [],
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      image: "/avatars/animals/cat-01.svg",
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .patch("/auth/user")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Ada Lovelace" })
      .expect(200);

    expect(response.body.user.image).toBe("/avatars/animals/cat-01.svg");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Ada Lovelace" },
      select: expect.any(Object),
    });
  });

  it("rejects arbitrary avatar values on profile update", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        authIdentities: [],
      })
      .mockResolvedValueOnce({ avatarStorageKey: null });

    const response = await request(app.getHttpServer())
      .patch("/auth/user")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Ada", image: "https://example.com/avatar.png" })
      .expect(400);

    expect(response.body.message).toBe("Выберите аватар из предложенного списка");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("clears avatar and deletes an uploaded object through profile update", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: "/auth/users/user-1/avatar",
        authIdentities: [],
      })
      .mockResolvedValueOnce({ avatarStorageKey: "avatars/user-1/old.png" });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .patch("/auth/user")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Ada", image: null })
      .expect(200);

    expect(response.body.user.image).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Ada", image: null, avatarStorageKey: null },
      select: expect.any(Object),
    });
    expect(avatarStorage.delete).toHaveBeenCalledWith("avatars/user-1/old.png");
  });

  it("requires authentication for avatar upload", async () => {
    await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(401);

    expect(avatarStorage.upload).not.toHaveBeenCalled();
  });

  it("uploads a valid avatar and returns the stable API avatar path", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        authIdentities: [],
      })
      .mockResolvedValueOnce({ id: "user-1", avatarStorageKey: null });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "/auth/users/user-1/avatar",
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(200);

    expect(response.body.user.image).toBe("/auth/users/user-1/avatar");
    expect(avatarStorage.upload).toHaveBeenCalledWith({
      userId: "user-1",
      buffer: pngAvatar,
      contentType: "image/png",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        image: "/auth/users/user-1/avatar",
        avatarStorageKey: "avatars/user-1/new-avatar.png",
      },
      select: expect.any(Object),
    });
  });

  it("rejects missing avatar files", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(response.body.message).toBe("Выберите файл аватара");
    expect(avatarStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects empty avatar files", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", Buffer.alloc(0), { filename: "avatar.png", contentType: "image/png" })
      .expect(400);

    expect(response.body.message).toBe("Файл аватара пуст");
    expect(avatarStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects invalid avatar MIME types", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", Buffer.from("hello"), { filename: "avatar.txt", contentType: "text/plain" })
      .expect(400);

    expect(response.body.message).toBe("Загрузите PNG, JPEG или WebP изображение");
    expect(avatarStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects oversized avatar files", async () => {
    process.env.AVATAR_MAX_BYTES = "4";
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(400);

    expect(response.body.message).toBe("Файл аватара слишком большой");
    expect(avatarStorage.upload).not.toHaveBeenCalled();
    delete process.env.AVATAR_MAX_BYTES;
  });

  it("does not update the user when avatar storage upload fails", async () => {
    avatarStorage.upload.mockRejectedValue(new Error("S3 unavailable"));
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        authIdentities: [],
      })
      .mockResolvedValueOnce({ id: "user-1", avatarStorageKey: null });

    await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(500);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("deletes a newly uploaded avatar when the database update fails", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        authIdentities: [],
      })
      .mockResolvedValueOnce({ id: "user-1", avatarStorageKey: null });
    prisma.user.update.mockRejectedValue(new Error("database unavailable"));

    await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(500);

    expect(avatarStorage.delete).toHaveBeenCalledWith("avatars/user-1/new-avatar.png");
  });

  it("deletes the replaced uploaded avatar after a successful replacement", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: "/auth/users/user-1/avatar",
        authIdentities: [],
      })
      .mockResolvedValueOnce({ id: "user-1", avatarStorageKey: "avatars/user-1/old.png" });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "/auth/users/user-1/avatar",
      authIdentities: [],
    });

    await request(app.getHttpServer())
      .post("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngAvatar, { filename: "avatar.png", contentType: "image/png" })
      .expect(200);

    expect(avatarStorage.delete).toHaveBeenCalledWith("avatars/user-1/old.png");
  });

  it("clears the uploaded avatar through the avatar endpoint", async () => {
    prisma.authSession.findFirst.mockResolvedValue({ userId: "user-1" });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: "/auth/users/user-1/avatar",
        authIdentities: [],
      })
      .mockResolvedValueOnce({ avatarStorageKey: "avatars/user-1/old.png" });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      authIdentities: [],
    });

    const response = await request(app.getHttpServer())
      .delete("/auth/user/avatar")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.user.image).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: null, avatarStorageKey: null },
      select: expect.any(Object),
    });
    expect(avatarStorage.delete).toHaveBeenCalledWith("avatars/user-1/old.png");
  });

  it("redirects uploaded avatar reads to a short-lived storage URL", async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarStorageKey: "avatars/user-1/avatar.png" });

    const response = await request(app.getHttpServer()).get("/auth/users/user-1/avatar").expect(302);

    expect(response.headers.location).toBe("https://storage.example.com/presigned-avatar");
    expect(response.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(avatarStorage.getReadUrl).toHaveBeenCalledWith("avatars/user-1/avatar.png");
  });

  it("returns not found for users without uploaded avatars", async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarStorageKey: null });

    await request(app.getHttpServer()).get("/auth/users/user-1/avatar").expect(404);

    expect(avatarStorage.getReadUrl).not.toHaveBeenCalled();
  });

  it("does not let Telegram overwrite a preset avatar while still updating identity metadata", async () => {
    const initData = createTelegramMiniAppInitData({
      user: {
        id: 123,
        first_name: "Ada",
        username: "ada",
        photo_url: "https://t.me/i/userpic/320/ada-new.jpg",
      },
    });
    prisma.authIdentity.findUnique.mockResolvedValue({ userId: "user-1" });
    const linkedUser = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: "/avatars/animals/cat-01.svg",
      authIdentities: [
        {
          provider: "telegram",
          username: "ada",
          displayName: "Ada",
          photoUrl: "https://t.me/i/userpic/320/ada-new.jpg",
        },
      ],
    };
    prisma.user.findUnique.mockResolvedValue(linkedUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(linkedUser);

    const response = await request(app.getHttpServer())
      .post("/auth/telegram-mini/session")
      .send({ initData })
      .expect(200);

    expect(response.body.user.image).toBe("/avatars/animals/cat-01.svg");
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: "telegram",
          providerUserId: "123",
        },
      },
      data: {
        username: "ada",
        displayName: "Ada",
        photoUrl: "https://t.me/i/userpic/320/ada-new.jpg",
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", image: null },
      data: { image: "https://t.me/i/userpic/320/ada-new.jpg" },
    });
  });
});
