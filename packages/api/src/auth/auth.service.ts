import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { AvatarStorageService } from "@/avatar/avatar-storage.service";
import { EmailService } from "@/email/email.service";
import { PrismaService } from "@/prisma/prisma.service";

import type {
  LoginDto,
  RegisterDto,
  RequestEmailVerificationDto,
  TelegramMiniAppSessionDto,
  UpdateUserDto,
} from "./auth.dto";
import { getSessionExpiresAt, hashSessionToken } from "./session-cookie";
import { validateTelegramMiniAppInitData } from "./telegram-mini-app";
import { type TelegramClaims, TelegramOidcClient } from "./telegram-oidc.client";
import { getUploadedUserAvatarPath, isPresetUserAvatar } from "./user-avatar-presets";

const VERIFICATION_TOKEN_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;
const REGISTRATION_EXPIRY_DAYS = 7;
const EMAIL_VERIFICATION_EXPIRY_DAYS = 7;
const TELEGRAM_PROVIDER = "telegram";
const TELEGRAM_STATE_BYTES = 32;
const TELEGRAM_NONCE_BYTES = 32;
const TELEGRAM_CODE_VERIFIER_BYTES = 48;
const DEFAULT_TELEGRAM_STATE_TTL_SECONDS = 600;
const DEFAULT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type TelegramAuthMode = "login" | "link";
type TelegramStatePayload = {
  state: string;
  nonce: string;
  codeVerifier: string;
  mode: TelegramAuthMode;
  returnTo: string;
  userId?: string;
  expiresAt: number;
};

type TelegramIdentitySummary = {
  linked: boolean;
  username: string | null;
  displayName: string | null;
  photoUrl: string | null;
};

type TelegramMiniAppRequestContext = {
  origin?: string;
  referer?: string;
  requestId?: string;
  userAgent?: string;
};

type AuthUserWithIdentities = Pick<User, "id" | "email" | "name" | "image"> & {
  authIdentities?: Array<{
    provider: string;
    username: string | null;
    displayName: string | null;
    photoUrl: string | null;
  }>;
};

type UserAvatarFile = Pick<Express.Multer.File, "buffer" | "mimetype" | "size">;

const TELEGRAM_AUTH_IDENTITY_SELECT = {
  where: { provider: TELEGRAM_PROVIDER },
  select: {
    provider: true,
    username: true,
    displayName: true,
    photoUrl: true,
  },
} satisfies Prisma.User$authIdentitiesArgs;

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  authIdentities: TELEGRAM_AUTH_IDENTITY_SELECT,
} satisfies Prisma.UserSelect;

const LOGIN_USER_SELECT = {
  ...AUTH_USER_SELECT,
  password: true,
  emailVerified: true,
} satisfies Prisma.UserSelect;

function getTelegramSummary(user: AuthUserWithIdentities): TelegramIdentitySummary {
  const telegram = user.authIdentities?.find((identity) => identity.provider === TELEGRAM_PROVIDER);
  return {
    linked: Boolean(telegram),
    username: telegram?.username ?? null,
    displayName: telegram?.displayName ?? null,
    photoUrl: telegram?.photoUrl ?? null,
  };
}

function toAuthUser(user: AuthUserWithIdentities) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    telegram: getTelegramSummary(user),
  };
}

function getRegistrationExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REGISTRATION_EXPIRY_DAYS);
  return expiresAt;
}

function getEmailVerificationExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EMAIL_VERIFICATION_EXPIRY_DAYS);
  return expiresAt;
}

function getActiveSessionWhere(token: string): Prisma.AuthSessionWhereInput {
  return {
    tokenHash: hashSessionToken(token),
    OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
    expiresAt: { gt: new Date() },
  };
}

function getTelegramStateTtlSeconds(): number {
  const configured = Number(process.env.TELEGRAM_AUTH_STATE_TTL_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_TELEGRAM_STATE_TTL_SECONDS;
}

function getTelegramStateSecret(): string {
  const secret =
    process.env.TELEGRAM_AUTH_STATE_SECRET?.trim() ||
    process.env.API_AUTH_SECRET?.trim() ||
    process.env.API_COOKIE_SECRET?.trim();

  if (!secret) {
    throw new ServiceUnavailableException("TELEGRAM_AUTH_STATE_SECRET is not configured");
  }

  return secret;
}

function getWebBaseUrl(): string {
  return process.env.WEB_APP_URL?.trim() || "http://localhost:3000";
}

function sanitizeReturnTo(value: string | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;

  try {
    const base = new URL(getWebBaseUrl());
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function signTelegramState(payload: TelegramStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getTelegramStateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function parseTelegramStateToken(token: string): TelegramStatePayload {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new UnauthorizedException("Telegram authentication state is invalid");
  }

  const expectedSignature = createHmac("sha256", getTelegramStateSecret()).update(body).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new UnauthorizedException("Telegram authentication state is invalid");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TelegramStatePayload;
  if (payload.expiresAt < Date.now()) {
    throw new UnauthorizedException("Telegram authentication state has expired");
  }

  return payload;
}

function getTelegramDisplayName(claims: TelegramClaims): string | null {
  return typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : null;
}

function getTelegramUsername(claims: TelegramClaims): string | null {
  return typeof claims.preferred_username === "string" && claims.preferred_username.trim()
    ? claims.preferred_username.trim()
    : null;
}

function getTelegramPhotoUrl(claims: TelegramClaims): string | null {
  return typeof claims.picture === "string" && claims.picture.trim() ? claims.picture.trim() : null;
}

function getTelegramProviderUserId(claims: TelegramClaims): string {
  if (typeof claims.id === "string" && claims.id.trim()) {
    return claims.id.trim();
  }

  if (typeof claims.id === "number" && Number.isSafeInteger(claims.id) && claims.id > 0) {
    return String(claims.id);
  }

  return claims.sub;
}

function getTelegramProviderUserIdHash(providerUserId: string): string {
  return createHash("sha256").update(providerUserId).digest("hex").slice(0, 12);
}

function getTelegramOidcIdLikeClaims(claims: TelegramClaims) {
  return Object.entries(claims)
    .filter(([key]) => key.toLowerCase().includes("id"))
    .map(([key, value]) => ({
      key,
      type: typeof value,
      value:
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : null,
    }));
}

function getAvatarMaxBytes(): number {
  const configured = Number(process.env.AVATAR_MAX_BYTES);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_AVATAR_MAX_BYTES;
}

function hasExpectedAvatarMagicBytes(file: UserAvatarFile): boolean {
  const buffer = file.buffer;

  if (file.mimetype === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (file.mimetype === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (file.mimetype === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(TelegramOidcClient) private readonly telegramOidcClient: TelegramOidcClient,
    @Inject(AvatarStorageService) private readonly avatarStorage: AvatarStorageService
  ) {}

  async register(input: RegisterDto): Promise<{ success: true }> {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    const existingPending = await this.prisma.pendingRegistration.findUnique({
      where: { email: input.email },
    });

    if (existingPending) {
      if (existingPending.expiresAt > new Date()) {
        throw new ConflictException("Регистрация с этим email уже начата. Проверьте вашу почту для подтверждения.");
      }

      await this.prisma.pendingRegistration.delete({
        where: { id: existingPending.id },
      });
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");

    const pendingRegistration = await this.prisma.pendingRegistration.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        token,
        expiresAt: getRegistrationExpiryDate(),
      },
    });

    const emailResult = await this.emailService.sendVerificationEmail(
      pendingRegistration.email,
      pendingRegistration.token,
      pendingRegistration.name
    );

    if ("error" in emailResult) {
      await this.prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      throw new ServiceUnavailableException(`Не удалось отправить письмо подтверждения: ${emailResult.error}`);
    }

    return { success: true };
  }

  async verifyEmail(token: string): Promise<{ success: true; userId: string }> {
    const pendingRegistration = await this.prisma.pendingRegistration.findUnique({
      where: { token },
    });

    if (!pendingRegistration) {
      return this.verifyPendingUserEmail(token);
    }

    if (pendingRegistration.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      throw new BadRequestException("Токен подтверждения истек. Пожалуйста, зарегистрируйтесь заново.");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: pendingRegistration.email },
    });

    if (existingUser) {
      await this.prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    const user = await this.prisma.user.create({
      data: {
        name: pendingRegistration.name,
        email: pendingRegistration.email,
        password: pendingRegistration.password,
        emailVerified: new Date(),
      },
    });

    await this.prisma.pendingRegistration.delete({
      where: { id: pendingRegistration.id },
    });

    return { success: true, userId: user.id };
  }

  private async verifyPendingUserEmail(token: string): Promise<{ success: true; userId: string }> {
    const pendingEmail = await this.prisma.pendingEmailVerification.findUnique({
      where: { token },
    });

    if (!pendingEmail) {
      throw new BadRequestException("Неверный токен подтверждения");
    }

    if (pendingEmail.expiresAt < new Date()) {
      await this.prisma.pendingEmailVerification.delete({
        where: { id: pendingEmail.id },
      });
      throw new BadRequestException("Токен подтверждения истек. Пожалуйста, запросите подтверждение email заново.");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: pendingEmail.email,
        id: { not: pendingEmail.userId },
      },
    });

    if (existingUser) {
      await this.prisma.pendingEmailVerification.delete({
        where: { id: pendingEmail.id },
      });
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    await this.prisma.user.update({
      where: { id: pendingEmail.userId },
      data: {
        email: pendingEmail.email,
        emailVerified: new Date(),
      },
    });

    await this.prisma.pendingEmailVerification.delete({
      where: { id: pendingEmail.id },
    });

    return { success: true, userId: pendingEmail.userId };
  }

  async login(input: LoginDto): Promise<{ token: string; user: ReturnType<typeof toAuthUser> }> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email },
      select: LOGIN_USER_SELECT,
    });

    if (!user?.password) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    if (!user.emailVerified) {
      const pendingRegistration = await this.prisma.pendingRegistration.findUnique({
        where: { email: input.email },
      });

      if (pendingRegistration) {
        throw new ForbiddenException("Email не подтвержден. Пожалуйста, проверьте вашу почту и подтвердите email.");
      }
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    const token = await this.createSessionForUser(user.id);

    return { token, user: toAuthUser(user) };
  }

  async createTelegramMiniAppSession(
    input: TelegramMiniAppSessionDto,
    context: TelegramMiniAppRequestContext = {}
  ): Promise<{ token: string; user: ReturnType<typeof toAuthUser> }> {
    const claims = validateTelegramMiniAppInitData(input.initData);
    const user = await this.findOrCreateTelegramUser(claims, { miniAppContext: context });
    const token = await this.createSessionForUser(user.id);
    this.logTelegramMiniAppSessionEvent("session_created", claims, {
      ...context,
      userId: user.id,
    });
    return { token, user };
  }

  async createSessionForUser(userId: string): Promise<string> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
    await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: getSessionExpiresAt(),
        revokedAt: null,
      },
    });
    return token;
  }

  async logout(token: string | null): Promise<{ success: true }> {
    if (token) {
      await this.prisma.authSession.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    }

    return { success: true };
  }

  async getUserBySessionToken(token: string | null): Promise<ReturnType<typeof toAuthUser> | null> {
    if (!token) return null;

    const session = await this.prisma.authSession.findFirst({
      where: getActiveSessionWhere(token),
      select: { userId: true },
    });

    if (!session) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: AUTH_USER_SELECT,
    });

    return user ? toAuthUser(user) : null;
  }

  async getUserBySessionTokens(tokens: string[]): Promise<ReturnType<typeof toAuthUser> | null> {
    for (const token of tokens.toReversed()) {
      const user = await this.getUserBySessionToken(token);
      if (user) return user;
    }

    return null;
  }

  async updateUser(userId: string, input: UpdateUserDto): Promise<ReturnType<typeof toAuthUser>> {
    const data: Prisma.UserUpdateInput = {
      name: input.name,
    };
    let oldAvatarStorageKey: string | null = null;

    if (input.image !== undefined) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { avatarStorageKey: true },
      });

      if (!currentUser) {
        throw new UnauthorizedException("Не авторизован");
      }

      oldAvatarStorageKey = currentUser.avatarStorageKey;

      if (input.image === null) {
        data.image = null;
        data.avatarStorageKey = null;
      } else if (typeof input.image === "string" && isPresetUserAvatar(input.image)) {
        data.image = input.image;
        data.avatarStorageKey = null;
      } else if (typeof input.image === "string" && input.image === getUploadedUserAvatarPath(userId)) {
        data.image = input.image;
      } else {
        throw new BadRequestException("Выберите аватар из предложенного списка");
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: AUTH_USER_SELECT,
    });

    if (oldAvatarStorageKey && data.avatarStorageKey === null) {
      await this.deleteAvatarBestEffort(oldAvatarStorageKey);
    }

    return toAuthUser(user);
  }

  async uploadUserAvatar(userId: string, file: UserAvatarFile | undefined): Promise<ReturnType<typeof toAuthUser>> {
    this.validateAvatarFile(file);

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarStorageKey: true },
    });

    if (!currentUser) {
      throw new UnauthorizedException("Не авторизован");
    }

    const newStorageKey = await this.avatarStorage.upload({
      userId,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          image: getUploadedUserAvatarPath(userId),
          avatarStorageKey: newStorageKey,
        },
        select: AUTH_USER_SELECT,
      });

      if (currentUser.avatarStorageKey) {
        await this.deleteAvatarBestEffort(currentUser.avatarStorageKey);
      }

      return toAuthUser(user);
    } catch (error) {
      await this.deleteAvatarBestEffort(newStorageKey);
      throw error;
    }
  }

  async deleteUserAvatar(userId: string): Promise<ReturnType<typeof toAuthUser>> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });

    if (!currentUser) {
      throw new UnauthorizedException("Не авторизован");
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        image: null,
        avatarStorageKey: null,
      },
      select: AUTH_USER_SELECT,
    });

    if (currentUser.avatarStorageKey) {
      await this.deleteAvatarBestEffort(currentUser.avatarStorageKey);
    }

    return toAuthUser(user);
  }

  async getUserAvatarReadUrl(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStorageKey: true },
    });

    if (!user?.avatarStorageKey) {
      throw new NotFoundException("Avatar not found");
    }

    return this.avatarStorage.getReadUrl(user.avatarStorageKey);
  }

  async requestEmailVerification(userId: string, input: RequestEmailVerificationDto): Promise<{ success: true }> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: input.email,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!currentUser) {
      throw new UnauthorizedException("Не авторизован");
    }

    if (currentUser.email === input.email && currentUser.emailVerified) {
      throw new ConflictException("Этот email уже подтвержден");
    }

    const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
    await this.prisma.pendingEmailVerification.upsert({
      where: { userId },
      update: {
        email: input.email,
        token,
        expiresAt: getEmailVerificationExpiryDate(),
      },
      create: {
        userId,
        email: input.email,
        token,
        expiresAt: getEmailVerificationExpiryDate(),
      },
    });

    const emailResult = await this.emailService.sendVerificationEmail(input.email, token, currentUser.name);

    if ("error" in emailResult) {
      await this.prisma.pendingEmailVerification.delete({
        where: { userId },
      });
      throw new ServiceUnavailableException(`Не удалось отправить письмо подтверждения: ${emailResult.error}`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: input.email,
        emailVerified: null,
      },
    });

    return { success: true };
  }

  startTelegramLogin(returnTo?: string): { authorizationUrl: string; stateCookieValue: string; ttlSeconds: number } {
    return this.createTelegramAuthorization("login", sanitizeReturnTo(returnTo));
  }

  startTelegramLink(
    userId: string,
    returnTo?: string
  ): { authorizationUrl: string; stateCookieValue: string; ttlSeconds: number } {
    return this.createTelegramAuthorization("link", sanitizeReturnTo(returnTo), userId);
  }

  async completeTelegramCallback(input: {
    code: string;
    state: string;
    stateCookieValue: string | null;
  }): Promise<{ token: string | null; returnTo: string; user: ReturnType<typeof toAuthUser> }> {
    if (!input.stateCookieValue) {
      throw new UnauthorizedException("Telegram authentication state is missing");
    }

    const statePayload = parseTelegramStateToken(input.stateCookieValue);
    if (statePayload.state !== input.state) {
      throw new UnauthorizedException("Telegram authentication state mismatch");
    }

    const claims = await this.telegramOidcClient.exchangeCodeForClaims({
      code: input.code,
      codeVerifier: statePayload.codeVerifier,
      nonce: statePayload.nonce,
    });
    this.logTelegramOidcClaims(claims, statePayload.mode);

    if (statePayload.mode === "link") {
      const user = await this.linkTelegramIdentityForUser(statePayload.userId, claims);
      return { token: null, returnTo: statePayload.returnTo, user };
    }

    const user = await this.findOrCreateTelegramUser(claims);
    const token = await this.createSessionForUser(user.id);
    return { token, returnTo: statePayload.returnTo, user };
  }

  async unlinkTelegram(userId: string): Promise<{ user: ReturnType<typeof toAuthUser> }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        emailVerified: true,
        authIdentities: {
          select: {
            id: true,
            provider: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }

    const telegramIdentity = user.authIdentities.find((identity) => identity.provider === TELEGRAM_PROVIDER);
    if (!telegramIdentity) {
      throw new BadRequestException("Telegram не подключен");
    }

    const hasEmailPassword = Boolean(user.email && user.password && user.emailVerified);
    const otherIdentityCount = user.authIdentities.filter((identity) => identity.provider !== TELEGRAM_PROVIDER).length;
    if (!hasEmailPassword && otherIdentityCount === 0) {
      throw new BadRequestException("Нельзя отключить Telegram: добавьте и подтвердите email с паролем");
    }

    await this.prisma.authIdentity.delete({
      where: { id: telegramIdentity.id },
    });

    const updatedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });

    return { user: toAuthUser(updatedUser) };
  }

  private createTelegramAuthorization(
    mode: TelegramAuthMode,
    returnTo: string,
    userId?: string
  ): { authorizationUrl: string; stateCookieValue: string; ttlSeconds: number } {
    const ttlSeconds = getTelegramStateTtlSeconds();
    const codeVerifier = randomBytes(TELEGRAM_CODE_VERIFIER_BYTES).toString("base64url");
    const payload: TelegramStatePayload = {
      state: randomBytes(TELEGRAM_STATE_BYTES).toString("hex"),
      nonce: randomBytes(TELEGRAM_NONCE_BYTES).toString("hex"),
      codeVerifier,
      mode,
      returnTo,
      userId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    const authorizationUrl = this.telegramOidcClient.getAuthorizationUrl({
      codeChallenge: createPkceChallenge(codeVerifier),
      nonce: payload.nonce,
      state: payload.state,
    });

    return {
      authorizationUrl,
      stateCookieValue: signTelegramState(payload),
      ttlSeconds,
    };
  }

  private logTelegramOidcClaims(claims: TelegramClaims, mode: TelegramAuthMode): void {
    this.logger.log({
      event: "telegram_oidc_claims",
      claimKeys: Object.keys(claims).sort(),
      hasPicture: Boolean(getTelegramPhotoUrl(claims)),
      idLikeClaims: getTelegramOidcIdLikeClaims(claims),
      mode,
      providerUserIdHash: getTelegramProviderUserIdHash(getTelegramProviderUserId(claims)),
      providerUserIdLength: getTelegramProviderUserId(claims).length,
      rawSubHash: getTelegramProviderUserIdHash(claims.sub),
      rawSubLength: claims.sub.length,
      telegramUsername: getTelegramUsername(claims),
    });
  }

  private logTelegramMiniAppSessionEvent(
    event: string,
    claims: TelegramClaims,
    context: TelegramMiniAppRequestContext & {
      existingIdentityUserId?: string | null;
      existingUserFound?: boolean;
      userId?: string;
    }
  ): void {
    this.logger.log({
      event,
      existingIdentityUserId: context.existingIdentityUserId,
      existingUserFound: context.existingUserFound,
      hasPhoto: Boolean(getTelegramPhotoUrl(claims)),
      origin: context.origin,
      providerUserIdHash: getTelegramProviderUserIdHash(getTelegramProviderUserId(claims)),
      referer: context.referer,
      requestId: context.requestId,
      telegramUsername: getTelegramUsername(claims),
      userAgent: context.userAgent,
      userId: context.userId,
    });
  }

  private async findOrCreateTelegramUser(
    claims: TelegramClaims,
    options: { miniAppContext?: TelegramMiniAppRequestContext } = {}
  ): Promise<ReturnType<typeof toAuthUser>> {
    const providerUserId = getTelegramProviderUserId(claims);
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId,
        },
      },
      select: { userId: true },
    });

    if (existingIdentity) {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: existingIdentity.userId },
        select: AUTH_USER_SELECT,
      });

      if (options.miniAppContext) {
        this.logTelegramMiniAppSessionEvent("identity_found", claims, {
          ...options.miniAppContext,
          existingIdentityUserId: existingIdentity.userId,
          existingUserFound: Boolean(existingUser),
        });
      }

      if (!existingUser) {
        throw new ConflictException(
          "Telegram аккаунт привязан к несуществующему пользователю. Переподключите Telegram."
        );
      }

      await this.updateTelegramIdentity(existingIdentity.userId, claims);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: existingIdentity.userId },
        select: AUTH_USER_SELECT,
      });
      return toAuthUser(user);
    }

    if (options.miniAppContext) {
      this.logTelegramMiniAppSessionEvent("identity_not_found", claims, options.miniAppContext);
    }

    return this.createTelegramUser(claims);
  }

  private async createTelegramUser(claims: TelegramClaims): Promise<ReturnType<typeof toAuthUser>> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: null,
          name: getTelegramDisplayName(claims) ?? getTelegramUsername(claims),
          image: getTelegramPhotoUrl(claims),
        },
        select: { id: true },
      });

      await tx.authIdentity.create({
        data: this.getTelegramIdentityData(user.id, claims),
      });

      const createdUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: AUTH_USER_SELECT,
      });
      return toAuthUser(createdUser);
    });
  }

  private async linkTelegramIdentityForUser(
    userId: string | undefined,
    claims: TelegramClaims
  ): Promise<ReturnType<typeof toAuthUser>> {
    if (!userId) {
      throw new UnauthorizedException("Telegram link state is invalid");
    }

    const providerUserId = getTelegramProviderUserId(claims);
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId,
        },
      },
      select: { userId: true },
    });

    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException("Этот Telegram аккаунт уже подключен к другому пользователю");
    }

    await this.prisma.authIdentity.upsert({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId,
        },
      },
      update: this.getTelegramIdentityMetadata(claims),
      create: this.getTelegramIdentityData(userId, claims),
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });

    return toAuthUser(user);
  }

  private async updateTelegramIdentity(userId: string, claims: TelegramClaims): Promise<void> {
    const providerUserId = getTelegramProviderUserId(claims);
    await this.prisma.authIdentity.update({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId,
        },
      },
      data: this.getTelegramIdentityMetadata(claims),
    });

    const photoUrl = getTelegramPhotoUrl(claims);
    if (photoUrl) {
      await this.prisma.user.updateMany({
        where: { id: userId, image: null },
        data: { image: photoUrl },
      });
    }
  }

  private validateAvatarFile(file: UserAvatarFile | undefined): asserts file is UserAvatarFile {
    if (!file) {
      throw new BadRequestException("Выберите файл аватара");
    }

    if (file.size <= 0 || file.buffer.length === 0) {
      throw new BadRequestException("Файл аватара пуст");
    }

    if (file.size > getAvatarMaxBytes()) {
      throw new BadRequestException("Файл аватара слишком большой");
    }

    if (!ACCEPTED_AVATAR_MIME_TYPES.has(file.mimetype) || !hasExpectedAvatarMagicBytes(file)) {
      throw new BadRequestException("Загрузите PNG, JPEG или WebP изображение");
    }
  }

  private async deleteAvatarBestEffort(storageKey: string): Promise<void> {
    try {
      await this.avatarStorage.delete(storageKey);
    } catch (error) {
      this.logger.warn({
        event: "avatar_delete_failed",
        message: error instanceof Error ? error.message : "Unknown avatar storage delete error",
      });
    }
  }

  private getTelegramIdentityData(userId: string, claims: TelegramClaims): Prisma.AuthIdentityCreateInput {
    return {
      user: { connect: { id: userId } },
      provider: TELEGRAM_PROVIDER,
      providerUserId: getTelegramProviderUserId(claims),
      ...this.getTelegramIdentityMetadata(claims),
    };
  }

  private getTelegramIdentityMetadata(claims: TelegramClaims) {
    return {
      username: getTelegramUsername(claims),
      displayName: getTelegramDisplayName(claims),
      photoUrl: getTelegramPhotoUrl(claims),
    };
  }
}
