"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { sendVerificationEmail } from "@/shared/lib/email";
import { deleteAvatar } from "@/shared/lib/file-upload";

import { registerSchema, updateUserSchema, type RegisterInput, type UpdateUserInput } from "./auth.validations";

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
      console.error("Ошибка отправки email при регистрации:", emailResult.error);
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
      return { error: "Токен подтверждения истек. Пожалуйста, зарегистрируйтесь заново." };
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const validated = updateUserSchema.parse(input);

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    const oldImage = currentUser?.image;
    const newImage = validated.image ?? null;

    if (oldImage && oldImage !== newImage) {
      await deleteAvatar(oldImage);
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validated.name,
        image: newImage,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    revalidatePath("/dashboard");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить пользователя" };
  }
}
