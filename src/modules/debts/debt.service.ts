"use server";

import type { DebtTransaction, Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { revalidateDebtRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  type AddToDebtInput,
  addToDebtSchema,
  type CloseDebtInput,
  type CreateDebtInput,
  closeDebtSchema,
  createDebtSchema,
  type UpdateDebtInput,
  type UpdateDebtTransactionInput,
  updateDebtSchema,
  updateDebtTransactionSchema,
} from "@/shared/lib/validations/debt";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { DebtStatus, DebtTransactionType, DebtType } from "./debt.constants";
import type { DebtWithRelations } from "./debt.types";

type PrismaTx = Prisma.TransactionClient;

type AccessibleDebt = Prisma.DebtGetPayload<{
  include: { account: true };
}>;

type AccessibleDebtTransaction = Prisma.DebtTransactionGetPayload<{
  include: {
    debt: {
      include: {
        account: true;
      };
    };
    account: true;
  };
}>;

type DebtTransactionBalanceEffect = Pick<DebtTransaction, "accountId" | "type" | "amount" | "toAmount">;

type DebtTransactionTotalsDelta = {
  amountDelta: string;
  remainingDelta: string;
};

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

async function getAccessibleDebtTransactionOrThrow(
  tx: PrismaTx,
  userId: string,
  debtTransactionId: string
): Promise<AccessibleDebtTransaction> {
  const debtTransaction = await tx.debtTransaction.findFirst({
    where: {
      id: debtTransactionId,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      debt: {
        include: {
          account: true,
        },
      },
      account: true,
    },
  });

  if (!debtTransaction) {
    throw new Error("Транзакция долга не найдена или доступ запрещён");
  }

  return debtTransaction;
}

function getDebtStatusFromRemainingAmount(remainingAmount: string) {
  return compareMoney(remainingAmount, "0") <= 0 ? DebtStatus.CLOSED : DebtStatus.OPEN;
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

function getDebtTransactionAccountAmount(transaction: DebtTransactionBalanceEffect) {
  return transaction.type === DebtTransactionType.CLOSED
    ? transaction.toAmount || transaction.amount
    : transaction.amount;
}

function getDebtTransactionBalanceDelta(debtType: string, transaction: DebtTransactionBalanceEffect) {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DebtTransactionType.CLOSED) {
    return debtType === DebtType.LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return debtType === DebtType.LENT ? subtractMoney("0", accountAmount) : accountAmount;
}

function getDebtDeletionBalanceDelta(debtType: string, transaction: DebtTransactionBalanceEffect) {
  return subtractMoney("0", getDebtTransactionBalanceDelta(debtType, transaction));
}

function getDebtTransactionTotalsDelta(transactionType: string, amount: string): DebtTransactionTotalsDelta {
  if (transactionType === DebtTransactionType.CLOSED) {
    return {
      amountDelta: "0",
      remainingDelta: subtractMoney("0", amount),
    };
  }

  return {
    amountDelta: amount,
    remainingDelta: amount,
  };
}

function addBalanceDelta(
  balanceDeltasByAccount: Map<string, string>,
  accountId: string | null | undefined,
  delta: string
) {
  if (!accountId || compareMoney(delta, "0") === 0) {
    return;
  }

  const currentDelta = balanceDeltasByAccount.get(accountId) || "0";
  balanceDeltasByAccount.set(accountId, addMoney(currentDelta, delta));
}

async function applyAccountBalanceDeltas(
  tx: PrismaTx,
  workspaceId: string,
  balanceDeltasByAccount: Map<string, string>
) {
  const accountIds = [...balanceDeltasByAccount.keys()];

  if (accountIds.length === 0) {
    return;
  }

  const accounts = await tx.account.findMany({
    where: {
      workspaceId,
      id: { in: accountIds },
    },
  });

  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  for (const [accountId, delta] of balanceDeltasByAccount) {
    if (compareMoney(delta, "0") === 0) {
      continue;
    }

    const account = accountsById.get(accountId);

    if (!account) {
      throw new Error("Счёт не найден");
    }

    const nextBalance = addMoney(account.balance, delta);

    if (compareMoney(nextBalance, "0") < 0) {
      throw new Error(`Недостаточно средств на счёте "${account.name}" (${account.balance})`);
    }

    await tx.account.update({
      where: { id: accountId },
      data: { balance: nextBalance },
    });
  }
}

async function reconcileDebtTransactionBalanceEffect(
  tx: PrismaTx,
  debt: Pick<AccessibleDebt, "workspaceId" | "type">,
  previousTransaction?: DebtTransactionBalanceEffect | null,
  nextTransaction?: DebtTransactionBalanceEffect | null
) {
  const balanceDeltasByAccount = new Map<string, string>();

  if (previousTransaction?.accountId) {
    addBalanceDelta(
      balanceDeltasByAccount,
      previousTransaction.accountId,
      getDebtDeletionBalanceDelta(debt.type, previousTransaction)
    );
  }

  if (nextTransaction?.accountId) {
    addBalanceDelta(
      balanceDeltasByAccount,
      nextTransaction.accountId,
      getDebtTransactionBalanceDelta(debt.type, nextTransaction)
    );
  }

  await applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);
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
      const debtTransactions = await tx.debtTransaction.findMany({
        where: { debtId: debt.id },
        select: {
          accountId: true,
          type: true,
          amount: true,
          toAmount: true,
        },
      });

      const balanceDeltasByAccount = new Map<string, string>();

      for (const transaction of debtTransactions) {
        if (!transaction.accountId) {
          continue;
        }

        addBalanceDelta(
          balanceDeltasByAccount,
          transaction.accountId,
          getDebtDeletionBalanceDelta(debt.type, transaction)
        );
      }

      await applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);

      await tx.debtTransaction.deleteMany({
        where: { debtId: debt.id },
      });

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
          status: getDebtStatusFromRemainingAmount(newRemaining),
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

export async function updateDebtTransaction(id: string, input: UpdateDebtTransactionInput) {
  try {
    const userId = await requireUserId();
    const validated = updateDebtTransactionSchema.parse(input);

    const updatedDebtTransaction = await prisma.$transaction(async (tx) => {
      const debtTransaction = await getAccessibleDebtTransactionOrThrow(tx, userId, id);
      const debt = debtTransaction.debt;

      if (debtTransaction.type === DebtTransactionType.CREATED) {
        throw new Error("Начальную транзакцию нужно редактировать через редактирование долга");
      }

      const currentTotals = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
      const nextTotals = getDebtTransactionTotalsDelta(debtTransaction.type, validated.amount);
      const nextDebtAmount = addMoney(debt.amount, subtractMoney(nextTotals.amountDelta, currentTotals.amountDelta));
      const nextRemainingAmount = addMoney(
        debt.remainingAmount,
        subtractMoney(nextTotals.remainingDelta, currentTotals.remainingDelta)
      );

      if (compareMoney(nextRemainingAmount, "0") < 0) {
        if (debtTransaction.type === DebtTransactionType.ADDED) {
          throw new Error(
            `Новая сумма не может быть меньше ${subtractMoney(debtTransaction.amount, debt.remainingAmount)} (остаток долга учтён)`
          );
        }

        throw new Error(
          `Сумма не может превышать остаток долга (${addMoney(debt.remainingAmount, debtTransaction.amount)})`
        );
      }

      let nextTransactionAccountId = debtTransaction.accountId;
      let nextTransactionToAmount: string | null = debtTransaction.toAmount;

      if (debtTransaction.type === DebtTransactionType.CLOSED) {
        if (!validated.accountId) {
          throw new Error("Выберите счёт");
        }

        const nextAccount = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, validated.accountId);
        const currenciesMatch = nextAccount.currency === debt.currency;

        if (!currenciesMatch && !validated.toAmount) {
          throw new Error("Укажите сумму отправления");
        }

        nextTransactionAccountId = nextAccount.id;
        nextTransactionToAmount = currenciesMatch ? null : validated.toAmount || null;
      }

      await reconcileDebtTransactionBalanceEffect(
        tx,
        debt,
        debtTransaction,
        debtTransaction.type === DebtTransactionType.CLOSED
          ? {
              accountId: nextTransactionAccountId,
              type: debtTransaction.type,
              amount: validated.amount,
              toAmount: nextTransactionToAmount,
            }
          : {
              accountId: debtTransaction.accountId,
              type: debtTransaction.type,
              amount: validated.amount,
              toAmount: null,
            }
      );

      await tx.debt.update({
        where: { id: debt.id },
        data: {
          amount: nextDebtAmount,
          remainingAmount: nextRemainingAmount,
          status: getDebtStatusFromRemainingAmount(nextRemainingAmount),
        },
      });

      return tx.debtTransaction.update({
        where: { id },
        data: {
          accountId: nextTransactionAccountId,
          amount: validated.amount,
          toAmount: nextTransactionToAmount,
          date: validated.date,
        },
      });
    });

    revalidateDebtRoutes();
    return { data: updatedDebtTransaction };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось обновить транзакцию долга";
    return { error: message };
  }
}

export async function deleteDebtTransaction(id: string) {
  try {
    const userId = await requireUserId();

    const deleted = await prisma.$transaction(async (tx) => {
      const debtTransaction = await getAccessibleDebtTransactionOrThrow(tx, userId, id);
      const debt = debtTransaction.debt;

      if (debtTransaction.type === DebtTransactionType.CREATED) {
        throw new Error("Начальную транзакцию долга нужно удалять вместе с долгом");
      }

      const totals = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
      const nextDebtAmount = addMoney(debt.amount, subtractMoney("0", totals.amountDelta));
      const nextRemainingAmount = addMoney(debt.remainingAmount, subtractMoney("0", totals.remainingDelta));

      if (compareMoney(nextRemainingAmount, "0") < 0) {
        throw new Error("Нельзя удалить транзакцию: её сумма уже учтена в погашенной части долга");
      }

      await reconcileDebtTransactionBalanceEffect(tx, debt, debtTransaction, null);

      await tx.debt.update({
        where: { id: debt.id },
        data: {
          amount: nextDebtAmount,
          remainingAmount: nextRemainingAmount,
          status: getDebtStatusFromRemainingAmount(nextRemainingAmount),
        },
      });

      await tx.debtTransaction.delete({
        where: { id },
      });

      return { success: true as const };
    });

    revalidateDebtRoutes();
    return deleted;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось удалить транзакцию долга";
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
