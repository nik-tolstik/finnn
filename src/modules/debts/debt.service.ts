"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createDebtSchema,
  closeDebtSchema,
  addToDebtSchema,
  type CreateDebtInput,
  type CloseDebtInput,
  type AddToDebtInput,
} from "@/shared/lib/validations/debt";
import { addMoney, subtractMoney, compareMoney } from "@/shared/utils/money";

import { DebtType, DebtStatus } from "./debt.constants";
import type { DebtWithRelations } from "./debt.types";

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

    let currency = validated.currency || "BYN";
    let accountId: string | null = null;

    if (validated.useAccount && validated.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: validated.accountId,
          workspaceId,
        },
      });

      if (!account) {
        return { error: "Счёт не найден" };
      }

      currency = account.currency;
      accountId = account.id;

      if (validated.type === DebtType.LENT) {
        if (compareMoney(validated.amount, account.balance) > 0) {
          return { error: `Сумма не может превышать баланс счёта (${account.balance})` };
        }
        await prisma.account.update({
          where: { id: account.id },
          data: { balance: subtractMoney(account.balance, validated.amount) },
        });
      } else {
        await prisma.account.update({
          where: { id: account.id },
          data: { balance: addMoney(account.balance, validated.amount) },
        });
      }
    }

    const debt = await prisma.debt.create({
      data: {
        workspaceId,
        type: validated.type,
        personName: validated.personName,
        amount: validated.amount,
        remainingAmount: validated.amount,
        currency,
        accountId,
        date: validated.date,
        status: DebtStatus.OPEN,
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    return { data: debt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось создать долг";
    return { error: message };
  }
}

export async function closeDebt(id: string, input: CloseDebtInput) {
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
      include: { account: true },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    if (debt.status === DebtStatus.CLOSED) {
      return { error: "Долг уже закрыт" };
    }

    const validated = closeDebtSchema.parse(input);

    if (compareMoney(validated.amount, debt.remainingAmount) > 0) {
      return { error: `Сумма не может превышать остаток долга (${debt.remainingAmount})` };
    }

    const newRemainingAmount = subtractMoney(debt.remainingAmount, validated.amount);
    const isClosed = compareMoney(newRemainingAmount, "0") <= 0;

    if (validated.useAccount && validated.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: validated.accountId,
          workspaceId: debt.workspaceId,
        },
      });

      if (!account) {
        return { error: "Счёт не найден" };
      }

      const currenciesMatch = account.currency === debt.currency;
      const amountToUse = currenciesMatch ? validated.amount : validated.toAmount || validated.amount;

      if (!currenciesMatch && !validated.toAmount) {
        return { error: "Укажите сумму отправления" };
      }

      if (debt.type === DebtType.LENT) {
        await prisma.account.update({
          where: { id: validated.accountId },
          data: { balance: addMoney(account.balance, amountToUse) },
        });
      } else {
        if (compareMoney(amountToUse, account.balance) > 0) {
          return { error: `Сумма не может превышать баланс счёта (${account.balance})` };
        }
        await prisma.account.update({
          where: { id: validated.accountId },
          data: { balance: subtractMoney(account.balance, amountToUse) },
        });
      }
    }

    const updatedDebt = await prisma.debt.update({
      where: { id },
      data: {
        remainingAmount: newRemainingAmount,
        status: isClosed ? DebtStatus.CLOSED : DebtStatus.OPEN,
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    return { data: updatedDebt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось закрыть долг";
    return { error: message };
  }
}

export async function addToDebt(id: string, input: AddToDebtInput) {
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
      include: { account: true },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    if (debt.status === DebtStatus.CLOSED) {
      return { error: "Нельзя добавить к закрытому долгу" };
    }

    const validated = addToDebtSchema.parse(input);

    if (validated.useAccount && debt.accountId && debt.account) {
      if (debt.type === DebtType.LENT) {
        if (compareMoney(validated.amount, debt.account.balance) > 0) {
          return { error: `Сумма не может превышать баланс счёта (${debt.account.balance})` };
        }
        await prisma.account.update({
          where: { id: debt.accountId },
          data: { balance: subtractMoney(debt.account.balance, validated.amount) },
        });
      } else {
        await prisma.account.update({
          where: { id: debt.accountId },
          data: { balance: addMoney(debt.account.balance, validated.amount) },
        });
      }
    }

    const updatedDebt = await prisma.debt.update({
      where: { id },
      data: {
        amount: addMoney(debt.amount, validated.amount),
        remainingAmount: addMoney(debt.remainingAmount, validated.amount),
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    return { data: updatedDebt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось добавить к долгу";
    return { error: message };
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
      include: { account: true },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    if (debt.accountId && debt.account) {
      if (debt.type === DebtType.LENT) {
        await prisma.account.update({
          where: { id: debt.accountId },
          data: { balance: addMoney(debt.account.balance, debt.remainingAmount) },
        });
      } else {
        if (compareMoney(debt.remainingAmount, debt.account.balance) > 0) {
          return { error: `Недостаточно средств на счёте для возврата долга (${debt.account.balance})` };
        }
        await prisma.account.update({
          where: { id: debt.accountId },
          data: { balance: subtractMoney(debt.account.balance, debt.remainingAmount) },
        });
      }
    }

    await prisma.debt.delete({
      where: { id },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось удалить долг";
    return { error: message };
  }
}

export interface DebtFilters {
  status?: DebtStatus;
  type?: DebtType;
  personName?: string;
}

export async function getDebts(
  workspaceId: string,
  filters?: DebtFilters
): Promise<{ data: DebtWithRelations[]; total: number }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Не авторизован");
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      throw new Error("Доступ запрещён");
    }

    const where: {
      workspaceId: string;
      status?: string;
      type?: string;
      personName?: { contains: string; mode: "insensitive" };
    } = {
      workspaceId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.personName) {
      where.personName = { contains: filters.personName, mode: "insensitive" };
    }

    const debts = await prisma.debt.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
            color: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { date: "desc" }],
    });

    const total = await prisma.debt.count({ where });

    return { data: debts, total };
  } catch {
    throw new Error("Не удалось загрузить долги");
  }
}
