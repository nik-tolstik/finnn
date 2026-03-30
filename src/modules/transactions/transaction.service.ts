"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  type CreatePaymentTransactionInput,
  type CreateTransferTransactionInput,
  createPaymentTransactionSchema,
  createTransferTransactionSchema,
  type UpdatePaymentTransactionInput,
  type UpdateTransferTransactionInput,
  updatePaymentTransactionSchema,
  updateTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import type { DebtTransactionWithRelations } from "../debts/debt.types";
import { PaymentTransactionType } from "./transaction.constants";
import type { CombinedTransaction } from "./transaction.types";
import type { TransactionListFilters } from "./transaction-filter.types";
import { filterCombinedTransactions } from "./utils/combined-transaction-filtering";

type PrismaTx = Prisma.TransactionClient;

const accountWithOwnerSelect = {
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
} satisfies Prisma.AccountSelect;

const categorySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

function applyPaymentTransactionBalance(balance: string, type: string, amount: string) {
  if (type === PaymentTransactionType.INCOME) {
    return addMoney(balance, amount);
  }

  if (type === PaymentTransactionType.EXPENSE) {
    return subtractMoney(balance, amount);
  }

  return balance;
}

function revertPaymentTransactionBalance(balance: string, type: string, amount: string) {
  if (type === PaymentTransactionType.INCOME) {
    return subtractMoney(balance, amount);
  }

  if (type === PaymentTransactionType.EXPENSE) {
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

export async function createPaymentTransaction(workspaceId: string, input: CreatePaymentTransactionInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createPaymentTransactionSchema.parse(input);

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

      if (validated.type === PaymentTransactionType.EXPENSE && compareMoney(validated.amount, account.balance) > 0) {
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

      const createdTransaction = await tx.paymentTransaction.create({
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
        data: { balance: applyPaymentTransactionBalance(account.balance, validated.type, validated.amount) },
      });

      return createdTransaction;
    });

    revalidateAccountingRoutes();
    return { data: transaction };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать транзакцию" };
  }
}

export async function createTransferTransaction(workspaceId: string, input: CreateTransferTransactionInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createTransferTransactionSchema.parse(input);

    const transfer = await prisma.$transaction(async (tx) => {
      const fromAccount = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.fromAccountId);
      const toAccount = await getWorkspaceAccountOrThrow(tx, workspaceId, validated.toAccountId);

      if (fromAccount.id === toAccount.id) {
        throw new Error("Нельзя перевести на тот же счёт");
      }

      if (compareMoney(validated.amount, fromAccount.balance) > 0) {
        throw new Error(`Сумма отправления не может превышать баланс счёта (${fromAccount.balance})`);
      }

      const createdTransfer = await tx.transferTransaction.create({
        data: {
          workspaceId,
          fromAccountId: validated.fromAccountId,
          toAccountId: validated.toAccountId,
          amount: validated.amount,
          toAmount: validated.toAmount,
          description: validated.description,
          date: validated.date,
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

      return createdTransfer;
    });

    revalidateAccountingRoutes();
    return { data: transfer };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать перевод" };
  }
}

export async function updatePaymentTransaction(id: string, input: UpdatePaymentTransactionInput) {
  try {
    const userId = await requireUserId();

    const validated = updatePaymentTransactionSchema.parse(input);

    const updated = await prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findFirst({
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

        const revertedOldBalance = revertPaymentTransactionBalance(
          oldAccount.balance.toString(),
          transaction.type,
          oldAmount
        );

        if (accountChanged) {
          const newAccount = await getWorkspaceAccountOrThrow(
            tx,
            transaction.workspaceId,
            newAccountId,
            "Новый счёт не найден"
          );

          if (transaction.type === PaymentTransactionType.EXPENSE && compareMoney(newAmount, newAccount.balance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${newAccount.balance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: revertedOldBalance },
          });

          await tx.account.update({
            where: { id: newAccountId },
            data: {
              balance: applyPaymentTransactionBalance(newAccount.balance.toString(), transaction.type, newAmount),
            },
          });
        } else {
          if (transaction.type === PaymentTransactionType.EXPENSE && compareMoney(newAmount, revertedOldBalance) > 0) {
            throw new Error(`Сумма не может превышать баланс счёта (${revertedOldBalance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: applyPaymentTransactionBalance(revertedOldBalance, transaction.type, newAmount) },
          });
        }
      }

      return tx.paymentTransaction.update({
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

export async function updateTransferTransaction(id: string, input: UpdateTransferTransactionInput) {
  try {
    const userId = await requireUserId();

    const validated = updateTransferTransactionSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.transferTransaction.findFirst({
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
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });

      if (!transfer) {
        throw new Error("Перевод не найден или доступ запрещён");
      }

      const oldFromAccount = transfer.fromAccount;
      const oldToAccount = transfer.toAccount;
      const oldAmount = transfer.amount;
      const oldToAmount = transfer.toAmount;

      const newFromAccountId = validated.fromAccountId || transfer.fromAccountId;
      const newToAccountId = validated.toAccountId || transfer.toAccountId;
      const newAmount = validated.amount || transfer.amount;
      const newToAmount = validated.toAmount || transfer.toAmount;
      const newDescription = validated.description ?? transfer.description;
      const newDate = validated.date || transfer.date;

      if (newFromAccountId === newToAccountId) {
        throw new Error("Нельзя перевести на тот же счёт");
      }

      await getWorkspaceAccountOrThrow(tx, transfer.workspaceId, newFromAccountId, "Счёт отправителя не найден");
      await getWorkspaceAccountOrThrow(tx, transfer.workspaceId, newToAccountId, "Счёт не найден");

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

      await tx.transferTransaction.update({
        where: { id },
        data: {
          fromAccountId: newFromAccountId,
          toAccountId: newToAccountId,
          amount: newAmount,
          toAmount: newToAmount,
          description: newDescription,
          date: newDate,
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

export async function deleteTransferTransaction(id: string) {
  try {
    const userId = await requireUserId();

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.transferTransaction.findFirst({
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
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });

      if (!transfer) {
        throw new Error("Перевод не найден или доступ запрещён");
      }

      await tx.account.update({
        where: { id: transfer.fromAccount.id },
        data: { balance: addMoney(transfer.fromAccount.balance, transfer.amount) },
      });

      await tx.account.update({
        where: { id: transfer.toAccount.id },
        data: { balance: subtractMoney(transfer.toAccount.balance, transfer.toAmount) },
      });

      await tx.transferTransaction.delete({
        where: { id },
      });
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить перевод" };
  }
}

export async function deletePaymentTransaction(id: string) {
  try {
    const userId = await requireUserId();

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findFirst({
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

      await tx.account.update({
        where: { id: transaction.account.id },
        data: {
          balance: revertPaymentTransactionBalance(transaction.account.balance, transaction.type, transaction.amount),
        },
      });

      await tx.paymentTransaction.delete({
        where: { id },
      });
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить транзакцию" };
  }
}

export type CombinedTransactionFilters = TransactionListFilters;

export async function getCombinedTransactions(
  workspaceId: string,
  filters?: CombinedTransactionFilters
): Promise<{ data: CombinedTransaction[]; total: number } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const paymentTransactionWhere: Prisma.PaymentTransactionWhereInput = { workspaceId };
    const transferTransactionWhere: Prisma.TransferTransactionWhereInput = { workspaceId };
    const debtTransactionWhere: Prisma.DebtTransactionWhereInput = {
      workspaceId,
      debt: {
        is: {
          workspaceId,
        },
      },
    };

    const [paymentTransactions, transferTransactions, debtTransactions] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: paymentTransactionWhere,
        include: {
          account: {
            select: accountWithOwnerSelect,
          },
          category: {
            select: categorySelect,
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.transferTransaction.findMany({
        where: transferTransactionWhere,
        include: {
          fromAccount: {
            select: accountWithOwnerSelect,
          },
          toAccount: {
            select: accountWithOwnerSelect,
          },
        },
        orderBy: { date: "desc" },
      }),
      filters?.includeDebtTransactions === false
        ? Promise.resolve([] as DebtTransactionWithRelations[])
        : prisma.debtTransaction.findMany({
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
                select: accountWithOwnerSelect,
              },
            },
            orderBy: { date: "desc" },
          }),
    ]);

    const combined: CombinedTransaction[] = [
      ...paymentTransactions.map((transaction) => ({ kind: "paymentTransaction" as const, data: transaction })),
      ...transferTransactions.map((transaction) => ({ kind: "transferTransaction" as const, data: transaction })),
      ...debtTransactions.map((transaction) => ({ kind: "debtTransaction" as const, data: transaction })),
    ];

    const filteredCombined = filterCombinedTransactions(combined, filters);

    filteredCombined.sort((a, b) => {
      const dateA = new Date(a.data.date).getTime();
      const dateB = new Date(b.data.date).getTime();
      return dateB - dateA;
    });

    const skip = filters?.skip ?? 0;
    const take = filters?.take ?? 50;
    const paginated = filteredCombined.slice(skip, skip + take);

    return { data: paginated, total: filteredCombined.length };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить транзакции" };
  }
}
