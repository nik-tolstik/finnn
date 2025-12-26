"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createDebtSchema,
  updateDebtSchema,
  closeDebtSchema,
  type CreateDebtInput,
  type UpdateDebtInput,
  type CloseDebtInput,
} from "@/shared/lib/validations/debt";
import { revalidatePath } from "next/cache";
import { addMoney, subtractMoney } from "@/shared/utils/money";

export async function createDebt(workspaceId: string, input: CreateDebtInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const validated = createDebtSchema.parse(input);

    // Проверяем, что счет принадлежит workspace
    const account = await prisma.account.findFirst({
      where: {
        id: validated.accountId,
        workspaceId,
      },
    });

    if (!account) {
      return { error: "Счёт не найден или доступ запрещён" };
    }

    // Создаем долг (accountId всегда обязателен в Prisma, используем первый доступный если не указан)
    const debtAccountId =
      validated.accountId ||
      (await prisma.account.findFirst({
        where: { workspaceId },
        select: { id: true },
      }))?.id;

    if (!debtAccountId) {
      return { error: "Не найден счёт для создания долга" };
    }

    const debt = await prisma.debt.create({
      data: {
        accountId: debtAccountId,
        type: validated.type,
        debtorName: validated.debtorName,
        amount: validated.amount,
        description: validated.description,
        dueDate: validated.dueDate,
        status: validated.status,
        workspaceId,
      },
    });

    // Обновляем баланс счета только если useAccount = true
    if (validated.useAccount && validated.accountId) {
      const accountToUpdate = await prisma.account.findFirst({
        where: {
          id: validated.accountId,
          workspaceId,
        },
      });

      if (accountToUpdate) {
        let newBalance = accountToUpdate.balance;
        if (validated.type === "lent") {
          // Я одалживаю - списываем деньги со счета
          newBalance = subtractMoney(accountToUpdate.balance, validated.amount);
        } else if (validated.type === "borrowed") {
          // Я занимаю - добавляем деньги на счет
          newBalance = addMoney(accountToUpdate.balance, validated.amount);
        }

        await prisma.account.update({
          where: { id: validated.accountId },
          data: { balance: newBalance },
        });
      }
    }

    revalidatePath("/debts");
    revalidatePath("/accounts");
    return { data: debt };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать долг" };
  }
}

export async function updateDebt(id: string, input: UpdateDebtInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    const validated = updateDebtSchema.parse(input);

    const updated = await prisma.debt.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/debts");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить долг" };
  }
}

export async function deleteDebt(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    await prisma.debt.delete({
      where: { id },
    });

    revalidatePath("/debts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить долг" };
  }
}

export async function getDebts(workspaceId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const debts = await prisma.debt.findMany({
      where: { workspaceId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: debts };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить долги" };
  }
}

export async function closeDebt(
  id: string,
  workspaceId: string,
  input: CloseDebtInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        account: true,
      },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    if (debt.status === "paid") {
      return { error: "Долг уже закрыт" };
    }

    const validated = closeDebtSchema.parse(input);

    // Вычисляем оставшуюся сумму долга
    const remainingAmount = subtractMoney(debt.amount, validated.paidAmount);
    const newStatus = parseFloat(remainingAmount) <= 0 ? "paid" : "pending";

    // Обновляем долг
    const updatedDebt = await prisma.debt.update({
      where: { id },
      data: {
        amount: remainingAmount,
        status: newStatus as "pending" | "paid" | "cancelled",
      },
    });

    // Обновляем баланс счета, если useAccount = true
    if (validated.useAccount && validated.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: validated.accountId,
          workspaceId,
        },
      });

      if (!account) {
        return { error: "Счёт не найден или доступ запрещён" };
      }

      let newBalance = account.balance;
      if (debt.type === "lent") {
        // Я одалживал - возвращают мне, добавляем на счет
        newBalance = addMoney(account.balance, validated.paidAmount);
      } else if (debt.type === "borrowed") {
        // Я занимал - возвращаю, списываем со счета
        newBalance = subtractMoney(account.balance, validated.paidAmount);
      }

      await prisma.account.update({
        where: { id: validated.accountId },
        data: { balance: newBalance },
      });
    }

    revalidatePath("/debts");
    revalidatePath("/accounts");
    return { data: updatedDebt };
  } catch (error: any) {
    return { error: error.message || "Не удалось закрыть долг" };
  }
}

