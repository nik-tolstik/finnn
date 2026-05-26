"use server";

import { fail, ok } from "@/shared/lib/action-result";
import { getCachedServerSession } from "@/shared/lib/auth-session";
import { prisma } from "@/shared/lib/prisma";
import { revalidateWorkspaceRoutes } from "@/shared/lib/revalidate-app-routes";

import { type UpdateUserInput, updateUserSchema } from "./auth.validations";

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
    return ok(updated);
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить пользователя");
  }
}
