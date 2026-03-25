"use server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { revalidateDebtRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  createDebtSchema,
  closeDebtSchema,
  addToDebtSchema,
  updateDebtSchema,
  type CreateDebtInput,
  type CloseDebtInput,
  type AddToDebtInput,
  type UpdateDebtInput,
} from "@/shared/lib/validations/debt";
import { addMoney, subtractMoney, compareMoney } from "@/shared/utils/money";

import { DebtType, DebtStatus, DebtTransactionType } from "./debt.constants";
import type { DebtWithRelations } from "./debt.types";

type PrismaTx = Prisma.TransactionClient;

type AccessibleDebt = Prisma.DebtGetPayload<{
  include: { account: true };
}>;

async function getWorkspaceAccountOrThrow(
  tx: PrismaTx,
  workspaceId: string,
  accountId: string,
  errorMessage = "Счёт не найден"
) {
  const account = await tx.account.findFirst({
    where: {
      id: accountId,
      workspaceId,
    },
  });

  if (!account) {
    throw new Error(errorMessage);
  }

  return account;
}

async function getAccessibleDebtOrThrow(tx: PrismaTx, userId: string, debtId: string): Promise<AccessibleDebt> {
  const debt = await tx.debt.findFirst({
    where: {
      id: debtId,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: { account: true },
  });

  if (!debt) {
    throw new Error("Долг не найден или доступ запрещён");
  }

  return debt;
}

async function applyInitialAmountDeltaToAccount(tx: PrismaTx, debt: AccessibleDebt, amountDelta: string) {
  if (!debt.accountId || compareMoney(amountDelta, "0") === 0) {
    return;
  }

  const account = await tx.account.findUnique({
    where: { id: debt.accountId },
  });

  if (!account) {
    return;
  }

  if (debt.type === DebtType.LENT) {
    if (compareMoney(amountDelta, "0") > 0 && compareMoney(account.balance, amountDelta) < 0) {
      throw new Error(`Сумма не может превышать баланс счёта (${account.balance})`);
    }

    await tx.account.update({
      where: { id: debt.accountId },
      data: { balance: subtractMoney(account.balance, amountDelta) },
    });
    return;
  }

  if (compareMoney(amountDelta, "0") < 0 && compareMoney(account.balance, subtractMoney("0", amountDelta)) < 0) {
    throw new Error(`Недостаточно средств на счёте (${account.balance})`);
  }

  await tx.account.update({
    where: { id: debt.accountId },
    data: { balance: addMoney(account.balance, amountDelta) },
  });
}

export async function createDebt(workspaceId: string, input: CreateDebtInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createDebtSchema.parse(input);

    const debt = await prisma.$transaction(async (tx) => {
      let currency = validated.currency || "BYN";
      let accountId: string | null = null;

      if (validated.useAccount && validated.accountId) {
        const account = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.accountId);

        currency = account.currency;
        accountId = account.id;

        if (validated.type === DebtType.LENT) {
          if (compareMoney(validated.amount, account.balance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${account.balance})`);
          }

          await tx.account.update({
            where: { id: account.id },
            data: { balance: subtractMoney(account.balance, validated.amount) },
          });
        } else {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: addMoney(account.balance, validated.amount) },
          });
        }
      }

      const createdDebt = await tx.debt.create({
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

      await tx.debtTransaction.create({
        data: {
          workspaceId,
          debtId: createdDebt.id,
          accountId,
          type: DebtTransactionType.CREATED,
          amount: validated.amount,
          date: validated.date,
        },
      });

      return createdDebt;
    });

    revalidateDebtRoutes();
    return { data: debt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось создать долг";
    return { error: message };
  }
}

export async function closeDebt(id: string, input: CloseDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = closeDebtSchema.parse(input);

    const updatedDebt = await prisma.$transaction(async (tx) => {
      const debt = await getAccessibleDebtOrThrow(tx, userId, id);

      if (debt.status === DebtStatus.CLOSED) {
        throw new Error("Долг уже закрыт");
      }

      if (compareMoney(validated.amount, debt.remainingAmount) > 0) {
        throw new Error(`Сумма не может превышать остаток долга (${debt.remainingAmount})`);
      }

      const newRemainingAmount = subtractMoney(debt.remainingAmount, validated.amount);
      const isClosed = compareMoney(newRemainingAmount, "0") <= 0;
      let currenciesMatch = true;

      if (validated.useAccount && validated.accountId) {
        const account = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, validated.accountId);
        currenciesMatch = account.currency === debt.currency;

        if (!currenciesMatch && !validated.toAmount) {
          throw new Error("Укажите сумму отправления");
        }

        const amountToUse = currenciesMatch ? validated.amount : validated.toAmount || validated.amount;

        if (debt.type === DebtType.LENT) {
          await tx.account.update({
            where: { id: validated.accountId },
            data: { balance: addMoney(account.balance, amountToUse) },
          });
        } else {
          if (compareMoney(amountToUse, account.balance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${account.balance})`);
          }

          await tx.account.update({
            where: { id: validated.accountId },
            data: { balance: subtractMoney(account.balance, amountToUse) },
          });
        }
      }

      const nextDebt = await tx.debt.update({
        where: { id },
        data: {
          remainingAmount: newRemainingAmount,
          status: isClosed ? DebtStatus.CLOSED : DebtStatus.OPEN,
        },
      });

      await tx.debtTransaction.create({
        data: {
          workspaceId: debt.workspaceId,
          debtId: debt.id,
          accountId: validated.useAccount ? validated.accountId || null : null,
          type: DebtTransactionType.CLOSED,
          amount: validated.amount,
          toAmount: !currenciesMatch ? validated.toAmount : null,
          date: new Date(),
        },
      });

      return nextDebt;
    });

    revalidateDebtRoutes();
    return { data: updatedDebt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось закрыть долг";
    return { error: message };
  }
}

export async function addToDebt(id: string, input: AddToDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = addToDebtSchema.parse(input);

    const updatedDebt = await prisma.$transaction(async (tx) => {
      const debt = await getAccessibleDebtOrThrow(tx, userId, id);

      if (debt.status === DebtStatus.CLOSED) {
        throw new Error("Нельзя добавить к закрытому долгу");
      }

      if (validated.useAccount && debt.accountId && debt.account) {
        const account = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, debt.accountId);

        if (debt.type === DebtType.LENT) {
          if (compareMoney(validated.amount, account.balance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${account.balance})`);
          }

          await tx.account.update({
            where: { id: debt.accountId },
            data: { balance: subtractMoney(account.balance, validated.amount) },
          });
        } else {
          await tx.account.update({
            where: { id: debt.accountId },
            data: { balance: addMoney(account.balance, validated.amount) },
          });
        }
      }

      const nextDebt = await tx.debt.update({
        where: { id },
        data: {
          amount: addMoney(debt.amount, validated.amount),
          remainingAmount: addMoney(debt.remainingAmount, validated.amount),
        },
      });

      await tx.debtTransaction.create({
        data: {
          workspaceId: debt.workspaceId,
          debtId: debt.id,
          accountId: validated.useAccount && debt.accountId ? debt.accountId : null,
          type: DebtTransactionType.ADDED,
          amount: validated.amount,
          date: new Date(),
        },
      });

      return nextDebt;
    });

    revalidateDebtRoutes();
    return { data: updatedDebt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось добавить к долгу";
    return { error: message };
  }
}

export async function deleteDebt(id: string) {
  try {
    const userId = await requireUserId();

    await prisma.$transaction(async (tx) => {
      const debt = await getAccessibleDebtOrThrow(tx, userId, id);

      if (debt.accountId && debt.account) {
        const account = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, debt.accountId);

        if (debt.type === DebtType.LENT) {
          await tx.account.update({
            where: { id: debt.accountId },
            data: { balance: addMoney(account.balance, debt.remainingAmount) },
          });
        } else {
          if (compareMoney(debt.remainingAmount, account.balance) > 0) {
            throw new Error(`Недостаточно средств на счёте для возврата долга (${account.balance})`);
          }

          await tx.account.update({
            where: { id: debt.accountId },
            data: { balance: subtractMoney(account.balance, debt.remainingAmount) },
          });
        }
      }

      await tx.debt.delete({
        where: { id },
      });
    });

    revalidateDebtRoutes();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось удалить долг";
    return { error: message };
  }
}

export async function getDebtEditData(debtId: string) {
  try {
    const userId = await requireUserId();

    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
        workspace: {
          members: {
            some: {
              userId,
            },
          },
        },
      },
    });

    if (!debt) {
      return { error: "Долг не найден или доступ запрещён" };
    }

    const createdTransaction = await prisma.debtTransaction.findFirst({
      where: {
        debtId,
        type: DebtTransactionType.CREATED,
      },
    });

    if (!createdTransaction) {
      return {
        data: {
          personName: debt.personName,
          initialAmount: debt.amount,
          initialDate: debt.date.toISOString(),
          currency: debt.currency,
        },
      };
    }

    return {
      data: {
        personName: debt.personName,
        initialAmount: createdTransaction.amount,
        initialDate: createdTransaction.date.toISOString(),
        currency: debt.currency,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить данные";
    return { error: message };
  }
}

export async function updateDebt(debtId: string, input: UpdateDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = updateDebtSchema.parse(input);

    const updatedDebt = await prisma.$transaction(async (tx) => {
      const debt = await getAccessibleDebtOrThrow(tx, userId, debtId);

      if (debt.status === DebtStatus.CLOSED) {
        throw new Error("Нельзя редактировать закрытый долг");
      }

      let initialTransaction = await tx.debtTransaction.findFirst({
        where: {
          debtId,
          type: DebtTransactionType.CREATED,
        },
      });

      if (!initialTransaction) {
        initialTransaction = await tx.debtTransaction.findFirst({
          where: { debtId },
          orderBy: { date: "asc" },
        });
      }

      const oldInitial = initialTransaction?.amount || debt.amount;
      const amountDelta = subtractMoney(validated.amount, oldInitial);
      const newRemaining = addMoney(debt.remainingAmount, amountDelta);

      if (compareMoney(newRemaining, "0") < 0) {
        throw new Error(
          `Новая изначальная сумма не может быть меньше ${subtractMoney(oldInitial, debt.remainingAmount)} (остаток долга учтён)`
        );
      }

      await applyInitialAmountDeltaToAccount(tx, debt, amountDelta);

      const nextDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          personName: validated.personName,
          date: validated.date,
          amount: addMoney(debt.amount, amountDelta),
          remainingAmount: newRemaining,
        },
      });

      if (initialTransaction) {
        await tx.debtTransaction.update({
          where: { id: initialTransaction.id },
          data: {
            amount: validated.amount,
            date: validated.date,
          },
        });
      } else {
        await tx.debtTransaction.create({
          data: {
            workspaceId: debt.workspaceId,
            debtId,
            accountId: debt.accountId,
            type: DebtTransactionType.CREATED,
            amount: validated.amount,
            date: validated.date,
          },
        });
      }

      return nextDebt;
    });

    revalidateDebtRoutes();
    return { data: updatedDebt };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось обновить долг";
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
    await requireWorkspaceAccess(workspaceId);

    const where: Prisma.DebtWhereInput = {
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
            icon: true,
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
