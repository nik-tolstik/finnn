"use server";

import { prisma } from "@/shared/lib/prisma";
import { registerSchema, type RegisterInput } from "./validations";
import bcrypt from "bcryptjs";

export async function registerAction(input: RegisterInput) {
  try {
    const validated = registerSchema.parse(input);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return { error: "User with this email already exists" };
    }

    const hashedPassword = await bcrypt.hash(validated.password, 10);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
      },
    });

    return { success: true, userId: user.id };
  } catch (error: any) {
    return { error: error.message || "Failed to register" };
  }
}

