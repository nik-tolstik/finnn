"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { getCachedServerSession } from "@/shared/lib/auth-session";
import { sendVerificationEmail } from "@/shared/lib/email";
import { serverLogger } from "@/shared/lib/logger";
import { prisma } from "@/shared/lib/prisma";
import { revalidateWorkspaceRoutes } from "@/shared/lib/revalidate-app-routes";

import { type RegisterInput, registerSchema, type UpdateUserInput, updateUserSchema } from "./auth.validations";

export async function registerAction(input: RegisterInput) {
  try {
    const validated = registerSchema.parse(input);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return { error: "Пользователь с таким email уже существует" };
    }

    const existingPending = await prisma.pendingRegistration.findUnique({
      where: { email: validated.email },
    });

    if (existingPending) {
      if (existingPending.expiresAt > new Date()) {
        return {
          error: "Регистрация с этим email уже начата. Проверьте вашу почту для подтверждения.",
        };
      } else {
        await prisma.pendingRegistration.delete({
          where: { id: existingPending.id },
        });
      }
    }

    const hashedPassword = await bcrypt.hash(validated.password, 10);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const pendingRegistration = await prisma.pendingRegistration.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
        token,
        expiresAt,
      },
    });

    const emailResult = await sendVerificationEmail(
      pendingRegistration.email,
      pendingRegistration.token,
      pendingRegistration.name
    );

    if (emailResult.error) {
      serverLogger.error("Error sending email during registration:", emailResult.error);
      await prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      return {
        error: `Не удалось отправить письмо подтверждения: ${emailResult.error}. Проверьте настройки email сервиса.`,
      };
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось зарегистрироваться" };
  }
}

export async function verifyEmail(token: string) {
  try {
    const pendingRegistration = await prisma.pendingRegistration.findUnique({
      where: { token },
    });

    if (!pendingRegistration) {
      return { error: "Неверный токен подтверждения" };
    }

    if (pendingRegistration.expiresAt < new Date()) {
      await prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      return {
        error: "Токен подтверждения истек. Пожалуйста, зарегистрируйтесь заново.",
      };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: pendingRegistration.email },
    });

    if (existingUser) {
      await prisma.pendingRegistration.delete({
        where: { id: pendingRegistration.id },
      });
      return { error: "Пользователь с таким email уже существует" };
    }

    const user = await prisma.user.create({
      data: {
        name: pendingRegistration.name,
        email: pendingRegistration.email,
        password: pendingRegistration.password,
        emailVerified: new Date(),
      },
    });

    await prisma.pendingRegistration.delete({
      where: { id: pendingRegistration.id },
    });

    return { success: true, userId: user.id };
  } catch (error: any) {
    return { error: error.message || "Не удалось подтвердить email" };
  }
}

export async function updateUser(input: UpdateUserInput) {
  try {
    const session = await getCachedServerSession();
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const validated = updateUserSchema.parse(input);

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validated.name,
        image: validated.image,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    revalidateWorkspaceRoutes();
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить пользователя" };
  }
}
