"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  type CreateTransactionInput,
  type CreateTransferInput,
  createTransactionSchema,
  createTransferSchema,
  type UpdateTransactionInput,
  type UpdateTransferInput,
  updateTransactionSchema,
  updateTransferSchema,
} from "@/shared/lib/validations/transaction";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { TransactionType } from "./transaction.constants";
import type { CombinedTransaction } from "./transaction.types";

type PrismaTx = Prisma.TransactionClient;

function applyTransactionBalance(balance: string, type: string, amount: string) {
  if (type === TransactionType.INCOME) {
    return addMoney(balance, amount);
  }

  if (type === TransactionType.EXPENSE) {
    return subtractMoney(balance, amount);
  }

  return balance;
}

function revertTransactionBalance(balance: string, type: string, amount: string) {
  if (type === TransactionType.INCOME) {
    return subtractMoney(balance, amount);
  }

  if (type === TransactionType.EXPENSE) {
    return addMoney(balance, amount);
  }

  return balance;
}

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

export async function createTransaction(workspaceId: string, input: CreateTransactionInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createTransactionSchema.parse(input);

    const transaction = await prisma.$transaction(async (tx) => {
      const account = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.accountId);

      const accountCreatedDate = new Date(account.createdAt);
      accountCreatedDate.setHours(0, 0, 0, 0);
      const transactionDate = new Date(validated.date);
      transactionDate.setHours(0, 0, 0, 0);

      if (transactionDate < accountCreatedDate) {
        throw new Error(
          `Дата транзакции не может быть раньше даты создания счета (${accountCreatedDate.toLocaleDateString("ru-RU")})`
        );
      }

      if (validated.type === TransactionType.EXPENSE && compareMoney(validated.amount, account.balance) > 0) {
        throw new Error(`Сумма не может превышать баланс счёта (${account.balance})`);
      }

      let finalCategoryId = validated.categoryId;
      if (validated.newCategory) {
        const category = await tx.category.create({
          data: {
            workspaceId,
            name: validated.newCategory.name,
            type: validated.newCategory.type,
          },
        });
        finalCategoryId = category.id;
        if (validated.categoryId?.startsWith("temp-")) {
          finalCategoryId = category.id;
        }
      }

      const createdTransaction = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: validated.accountId,
          amount: validated.amount,
          type: validated.type,
          description: validated.description,
          date: validated.date,
          categoryId: finalCategoryId,
        },
      });

      await tx.account.update({
        where: { id: validated.accountId },
        data: { balance: applyTransactionBalance(account.balance, validated.type, validated.amount) },
      });

      return createdTransaction;
    });

    revalidateAccountingRoutes();
    return { data: transaction };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать транзакцию" };
  }
}

export async function createTransfer(workspaceId: string, input: CreateTransferInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createTransferSchema.parse(input);

    const transferData = await prisma.$transaction(async (tx) => {
      const fromAccount = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.fromAccountId);
      const toAccount = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.toAccountId);

      if (fromAccount.id === toAccount.id) {
        throw new Error("Нельзя перевести на тот же счёт");
      }

      if (compareMoney(validated.amount, fromAccount.balance) > 0) {
        throw new Error(`Сумма отправления не может превышать баланс счёта (${fromAccount.balance})`);
      }

      const fromTransaction = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: validated.fromAccountId,
          amount: validated.amount,
          type: TransactionType.TRANSFER,
          description: validated.description || `Перевод на ${toAccount.name}`,
          date: validated.date,
        },
      });

      const toTransaction = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: validated.toAccountId,
          amount: validated.toAmount,
          type: TransactionType.TRANSFER,
          description: validated.description || `Перевод с ${fromAccount.name}`,
          date: validated.date,
        },
      });

      await tx.transfer.create({
        data: {
          fromTransactionId: fromTransaction.id,
          toTransactionId: toTransaction.id,
          amount: validated.amount,
          toAmount: validated.toAmount,
        },
      });

      await tx.account.update({
        where: { id: validated.fromAccountId },
        data: { balance: subtractMoney(fromAccount.balance, validated.amount) },
      });

      await tx.account.update({
        where: { id: validated.toAccountId },
        data: { balance: addMoney(toAccount.balance, validated.toAmount) },
      });

      return { fromTransaction, toTransaction };
    });

    revalidateAccountingRoutes();
    return { data: transferData };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать перевод" };
  }
}

export async function updateTransaction(id: string, input: UpdateTransactionInput) {
  try {
    const userId = await requireUserId();

    const validated = updateTransactionSchema.parse(input);

    const updated = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: {
          id,
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

      if (!transaction) {
        throw new Error("Транзакция не найдена или доступ запрещён");
      }

      const oldAccountId = transaction.accountId;
      const newAccountId = validated.accountId || oldAccountId;
      const accountChanged = oldAccountId !== newAccountId;

      const oldAmount = transaction.amount.toString();
      const newAmount = validated.amount || oldAmount;
      const amountChanged = oldAmount !== newAmount;

      if (accountChanged || amountChanged) {
        const oldAccount = await tx.account.findUnique({
          where: { id: oldAccountId },
        });

        if (!oldAccount) {
          throw new Error("Старый счёт не найден");
        }

        const revertedOldBalance = revertTransactionBalance(oldAccount.balance.toString(), transaction.type, oldAmount);

        if (accountChanged) {
          const newAccount = await getWorkspaceAccountOrThrow(
            tx,
            transaction.workspaceId,
            newAccountId,
            "Новый счёт не найден"
          );

          if (transaction.type === TransactionType.EXPENSE && compareMoney(newAmount, newAccount.balance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${newAccount.balance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: revertedOldBalance },
          });

          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: applyTransactionBalance(newAccount.balance.toString(), transaction.type, newAmount) },
          });
        } else {
          if (transaction.type === TransactionType.EXPENSE && compareMoney(newAmount, revertedOldBalance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${revertedOldBalance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: applyTransactionBalance(revertedOldBalance, transaction.type, newAmount) },
          });
        }
      }

      return tx.transaction.update({
        where: { id },
        data: validated,
      });
    });

    revalidateAccountingRoutes();
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить транзакцию" };
  }
}

export async function updateTransfer(fromTransactionId: string, input: UpdateTransferInput) {
  try {
    const userId = await requireUserId();

    const validated = updateTransferSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const fromTransaction = await tx.transaction.findFirst({
        where: {
          id: fromTransactionId,
          workspace: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        include: {
          account: true,
          transferFrom: {
            include: {
              toTransaction: {
                include: {
                  account: true,
                },
              },
            },
          },
        },
      });

      if (!fromTransaction?.transferFrom) {
        throw new Error("Перевод не найден или доступ запрещён");
      }

      const toTransaction = fromTransaction.transferFrom.toTransaction;
      const oldFromAccount = fromTransaction.account;
      const oldToAccount = toTransaction.account;
      const oldAmount = fromTransaction.amount;
      const oldToAmount = toTransaction.amount;

      const newFromAccountId = validated.fromAccountId || fromTransaction.accountId;
      const newToAccountId = validated.toAccountId || toTransaction.accountId;
      const newAmount = validated.amount || fromTransaction.amount;
      const newToAmount = validated.toAmount || toTransaction.amount;
      const newDescription = validated.description ?? fromTransaction.description;
      const newDate = validated.date || fromTransaction.date;

      if (newFromAccountId === newToAccountId) {
        throw new Error("Нельзя перевести на тот же счёт");
      }

      await getWorkspaceAccountOrThrow(tx, fromTransaction.workspaceId, newFromAccountId, "Счёт отправителя не найден");
      await getWorkspaceAccountOrThrow(tx, fromTransaction.workspaceId, newToAccountId, "Счёт не найден");

      const oldFromAccountCurrent = await tx.account.findUnique({
        where: { id: oldFromAccount.id },
        select: { balance: true },
      });
      const oldToAccountCurrent = await tx.account.findUnique({
        where: { id: oldToAccount.id },
        select: { balance: true },
      });

      if (!oldFromAccountCurrent || !oldToAccountCurrent) {
        throw new Error("Счёт не найден");
      }

      await tx.account.update({
        where: { id: oldFromAccount.id },
        data: { balance: addMoney(oldFromAccountCurrent.balance, oldAmount) },
      });

      await tx.account.update({
        where: { id: oldToAccount.id },
        data: { balance: subtractMoney(oldToAccountCurrent.balance, oldToAmount) },
      });

      const newFromAccountCurrent = await tx.account.findUnique({
        where: { id: newFromAccountId },
        select: { balance: true },
      });
      const newToAccountCurrent = await tx.account.findUnique({
        where: { id: newToAccountId },
        select: { balance: true },
      });

      if (!newFromAccountCurrent || !newToAccountCurrent) {
        throw new Error("Счёт не найден");
      }

      if (compareMoney(newAmount, newFromAccountCurrent.balance) > 0) {
        throw new Error(`Сумма отправления не может превышать баланс счёта (${newFromAccountCurrent.balance})`);
      }

      await tx.transaction.update({
        where: { id: fromTransactionId },
        data: {
          accountId: newFromAccountId,
          amount: newAmount,
          description: newDescription,
          date: newDate,
        },
      });

      await tx.transaction.update({
        where: { id: toTransaction.id },
        data: {
          accountId: newToAccountId,
          amount: newToAmount,
          description: newDescription,
          date: newDate,
        },
      });

      await tx.transfer.update({
        where: { fromTransactionId },
        data: {
          amount: newAmount,
          toAmount: newToAmount,
        },
      });

      await tx.account.update({
        where: { id: newFromAccountId },
        data: { balance: subtractMoney(newFromAccountCurrent.balance, newAmount) },
      });

      await tx.account.update({
        where: { id: newToAccountId },
        data: { balance: addMoney(newToAccountCurrent.balance, newToAmount) },
      });
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить перевод" };
  }
}

async function deleteTransferInTransaction(tx: PrismaTx, userId: string, transactionId: string) {
  const transaction = await tx.transaction.findFirst({
    where: {
      id: transactionId,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      account: true,
      transferFrom: {
        include: {
          toTransaction: {
            include: {
              account: true,
            },
          },
        },
      },
      transferTo: {
        include: {
          fromTransaction: {
            include: {
              account: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new Error("Транзакция не найдена или доступ запрещён");
  }

  let fromTransaction: typeof transaction & { account: typeof transaction.account };
  let toTransaction: typeof transaction & { account: typeof transaction.account };

  if (transaction.transferFrom) {
    fromTransaction = transaction;
    toTransaction = transaction.transferFrom.toTransaction as typeof transaction & {
      account: typeof transaction.account;
    };
  } else if (transaction.transferTo) {
    fromTransaction = transaction.transferTo.fromTransaction as typeof transaction & {
      account: typeof transaction.account;
    };
    toTransaction = transaction;
  } else {
    throw new Error("Перевод не найден");
  }

  await tx.account.update({
    where: { id: fromTransaction.account.id },
    data: { balance: addMoney(fromTransaction.account.balance, fromTransaction.amount) },
  });

  await tx.account.update({
    where: { id: toTransaction.account.id },
    data: { balance: subtractMoney(toTransaction.account.balance, toTransaction.amount) },
  });

  await tx.transfer.delete({
    where: { fromTransactionId: fromTransaction.id },
  });

  await tx.transaction.delete({
    where: { id: fromTransaction.id },
  });

  await tx.transaction.delete({
    where: { id: toTransaction.id },
  });
}

export async function deleteTransfer(transactionId: string) {
  try {
    const userId = await requireUserId();

    await prisma.$transaction((tx) => deleteTransferInTransaction(tx, userId, transactionId));

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить перевод" };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const userId = await requireUserId();

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: {
          id,
          workspace: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        include: { account: true, transferFrom: true, transferTo: true },
      });

      if (!transaction) {
        throw new Error("Транзакция не найдена или доступ запрещён");
      }

      if (transaction.transferFrom || transaction.transferTo) {
        await deleteTransferInTransaction(tx, userId, id);
        return;
      }

      await tx.account.update({
        where: { id: transaction.account.id },
        data: { balance: revertTransactionBalance(transaction.account.balance, transaction.type, transaction.amount) },
      });

      await tx.transaction.delete({
        where: { id },
      });
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить транзакцию" };
  }
}

export interface CombinedTransactionFilters {
  skip?: number;
  take?: number;
  includeDebtTransactions?: boolean;
}

export async function getCombinedTransactions(
  workspaceId: string,
  filters?: CombinedTransactionFilters
): Promise<{ data: CombinedTransaction[]; total: number } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const transactionWhere: any = { workspaceId };
    const debtTransactionWhere: any = {
      workspaceId,
      debt: {
        is: {
          workspaceId,
        },
      },
    };

    const transactions = await prisma.transaction.findMany({
      where: transactionWhere,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
            color: true,
            icon: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        transferFrom: {
          include: {
            toTransaction: {
              select: {
                id: true,
                account: {
                  select: {
                    id: true,
                    name: true,
                    currency: true,
                    color: true,
                    icon: true,
                    ownerId: true,
                    owner: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        transferTo: {
          include: {
            fromTransaction: {
              select: {
                id: true,
                account: {
                  select: {
                    id: true,
                    name: true,
                    currency: true,
                    color: true,
                    icon: true,
                    ownerId: true,
                    owner: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    let debtTransactions: any[] = [];
    if (filters?.includeDebtTransactions !== false) {
      debtTransactions = await prisma.debtTransaction.findMany({
        where: debtTransactionWhere,
        include: {
          debt: {
            select: {
              id: true,
              workspaceId: true,
              type: true,
              personName: true,
              amount: true,
              remainingAmount: true,
              currency: true,
              accountId: true,
              date: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
              currency: true,
              color: true,
              icon: true,
              ownerId: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
      });
    }

    const combined: CombinedTransaction[] = [
      ...transactions.map((t) => ({ kind: "transaction" as const, data: t })),
      ...debtTransactions.map((dt) => ({ kind: "debtTransaction" as const, data: dt })),
    ];

    combined.sort((a, b) => {
      const dateA = new Date(a.data.date).getTime();
      const dateB = new Date(b.data.date).getTime();
      return dateB - dateA;
    });

    const skip = filters?.skip ?? 0;
    const take = filters?.take ?? 50;
    const paginated = combined.slice(skip, skip + take);

    const transactionCount = await prisma.transaction.count({ where: transactionWhere });
    const debtTransactionCount =
      filters?.includeDebtTransactions !== false
        ? await prisma.debtTransaction.count({ where: debtTransactionWhere })
        : 0;

    return { data: paginated, total: transactionCount + debtTransactionCount };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить транзакции" };
  }
}
