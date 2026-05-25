import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { EmailService } from "@/email/email.service";
import { PrismaService } from "@/prisma/prisma.service";

import type { LoginDto, RegisterDto, UpdateUserDto } from "./auth.dto";
import { getSessionExpiresAt, hashSessionToken } from "./session-cookie";

const VERIFICATION_TOKEN_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;
const REGISTRATION_EXPIRY_DAYS = 7;

function toAuthUser(user: Pick<User, "id" | "email" | "name" | "image">) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

function getRegistrationExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REGISTRATION_EXPIRY_DAYS);
  return expiresAt;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  async register(input: RegisterDto): Promise<{ success: true }> {
    const existingUser = await this.prisma.user.findUnique({
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
      throw new BadRequestException("Неверный токен подтверждения");
    }

    if (pendingRegistration.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      throw new BadRequestException("Токен подтверждения истек. Пожалуйста, зарегистрируйтесь заново.");
    }

    const existingUser = await this.prisma.user.findUnique({
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

  async login(input: LoginDto): Promise<{ token: string; user: ReturnType<typeof toAuthUser> }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
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

    const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: getSessionExpiresAt(),
      },
    });

    return { token, user: toAuthUser(user) };
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
      where: {
        tokenHash: hashSessionToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });

    if (!session) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    });

    return user ? toAuthUser(user) : null;
  }

  async updateUser(userId: string, input: UpdateUserDto): Promise<ReturnType<typeof toAuthUser>> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        image: input.image ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    });

    return toAuthUser(user);
  }
}
