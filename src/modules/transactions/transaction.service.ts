"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createTransactionSchema,
  createTransferSchema,
  updateTransactionSchema,
  updateTransferSchema,
  type CreateTransactionInput,
  type CreateTransferInput,
  type UpdateTransactionInput,
  type UpdateTransferInput,
} from "@/shared/lib/validations/transaction";
import { addMoney, subtractMoney } from "@/shared/utils/money";

export async function createTransaction(
  workspaceId: string,
  input: CreateTransactionInput
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

    const validated = createTransactionSchema.parse(input);

    const account = await prisma.account.findFirst({
      where: {
        id: validated.accountId,
        workspaceId,
      },
    });

    if (!account) {
      return { error: "Счёт не найден" };
    }

    const accountCreatedDate = new Date(account.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);
    const transactionDate = new Date(validated.date);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate < accountCreatedDate) {
      return {
        error: `Дата транзакции не может быть раньше даты создания счета (${accountCreatedDate.toLocaleDateString("ru-RU")})`,
      };
    }

    let finalCategoryId = validated.categoryId;
    if (validated.newCategory) {
      const category = await prisma.category.create({
        data: {
          workspaceId,
          name: validated.newCategory.name,
          color: validated.newCategory.color,
          type: validated.newCategory.type,
        },
      });
      finalCategoryId = category.id;
      if (validated.categoryId?.startsWith("temp-")) {
        finalCategoryId = category.id;
      }
    }

    const transaction = await prisma.transaction.create({
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

    let newBalance = account.balance;
    if (validated.type === "income") {
      newBalance = addMoney(account.balance, validated.amount);
    } else if (validated.type === "expense") {
      newBalance = subtractMoney(account.balance, validated.amount);
    }

    await prisma.account.update({
      where: { id: validated.accountId },
      data: { balance: newBalance },
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { data: transaction };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать транзакцию" };
  }
}

export async function createTransfer(
  workspaceId: string,
  input: CreateTransferInput
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

    const validated = createTransferSchema.parse(input);

    const fromAccount = await prisma.account.findFirst({
      where: {
        id: validated.fromAccountId,
        workspaceId,
      },
    });

    const toAccount = await prisma.account.findFirst({
      where: {
        id: validated.toAccountId,
        workspaceId,
      },
    });

    if (!fromAccount || !toAccount) {
      return { error: "Счёт не найден" };
    }

    if (fromAccount.id === toAccount.id) {
      return { error: "Нельзя перевести на тот же счёт" };
    }

    const fromTransaction = await prisma.transaction.create({
      data: {
        workspaceId,
        accountId: validated.fromAccountId,
        amount: validated.amount,
        type: "transfer",
        description: validated.description || `Перевод на ${toAccount.name}`,
        date: validated.date,
      },
    });

    const toTransaction = await prisma.transaction.create({
      data: {
        workspaceId,
        accountId: validated.toAccountId,
        amount: validated.toAmount,
        type: "transfer",
        description: validated.description || `Перевод с ${fromAccount.name}`,
        date: validated.date,
      },
    });

    await prisma.transfer.create({
      data: {
        fromTransactionId: fromTransaction.id,
        toTransactionId: toTransaction.id,
        amount: validated.amount,
        toAmount: validated.toAmount,
      },
    });

    await prisma.account.update({
      where: { id: validated.fromAccountId },
      data: { balance: subtractMoney(fromAccount.balance, validated.amount) },
    });

    await prisma.account.update({
      where: { id: validated.toAccountId },
      data: { balance: addMoney(toAccount.balance, validated.toAmount) },
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { data: { fromTransaction, toTransaction } };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать перевод" };
  }
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const transaction = await prisma.transaction.findFirst({
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

    if (!transaction) {
      return { error: "Транзакция не найдена или доступ запрещён" };
    }

    const validated = updateTransactionSchema.parse(input);

    const updated = await prisma.transaction.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/transactions");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить транзакцию" };
  }
}

export async function updateTransfer(
  fromTransactionId: string,
  input: UpdateTransferInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const fromTransaction = await prisma.transaction.findFirst({
      where: {
        id: fromTransactionId,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
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

    if (!fromTransaction || !fromTransaction.transferFrom) {
      return { error: "Перевод не найден или доступ запрещён" };
    }

    const validated = updateTransferSchema.parse(input);
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
      return { error: "Нельзя перевести на тот же счёт" };
    }

    const newFromAccount = await prisma.account.findFirst({
      where: {
        id: newFromAccountId,
        workspaceId: fromTransaction.workspaceId,
      },
    });

    const newToAccount = await prisma.account.findFirst({
      where: {
        id: newToAccountId,
        workspaceId: fromTransaction.workspaceId,
      },
    });

    if (!newFromAccount || !newToAccount) {
      return { error: "Счёт не найден" };
    }

    await prisma.transaction.update({
      where: { id: fromTransactionId },
      data: {
        accountId: newFromAccountId,
        amount: newAmount,
        description: newDescription,
        date: newDate,
      },
    });

    await prisma.transaction.update({
      where: { id: toTransaction.id },
      data: {
        accountId: newToAccountId,
        amount: newToAmount,
        description: newDescription,
        date: newDate,
      },
    });

    const oldFromAccountBalance = await prisma.account.findUnique({
      where: { id: oldFromAccount.id },
      select: { balance: true },
    });
    const oldToAccountBalance = await prisma.account.findUnique({
      where: { id: oldToAccount.id },
      select: { balance: true },
    });

    if (oldFromAccountBalance) {
      const correctedBalance = addMoney(
        oldFromAccountBalance.balance,
        oldAmount
      );
      await prisma.account.update({
        where: { id: oldFromAccount.id },
        data: { balance: correctedBalance },
      });
    }

    if (oldToAccountBalance) {
      const correctedBalance = subtractMoney(
        oldToAccountBalance.balance,
        oldToAmount
      );
      await prisma.account.update({
        where: { id: oldToAccount.id },
        data: { balance: correctedBalance },
      });
    }

    await prisma.transaction.update({
      where: { id: fromTransactionId },
      data: {
        accountId: newFromAccountId,
        amount: newAmount,
        description: newDescription,
        date: newDate,
      },
    });

    await prisma.transaction.update({
      where: { id: toTransaction.id },
      data: {
        accountId: newToAccountId,
        amount: newToAmount,
        description: newDescription,
        date: newDate,
      },
    });

    await prisma.transfer.update({
      where: { fromTransactionId },
      data: {
        amount: newAmount,
        toAmount: newToAmount,
      },
    });

    const newFromAccountBalance = await prisma.account.findUnique({
      where: { id: newFromAccountId },
      select: { balance: true },
    });
    const newToAccountBalance = await prisma.account.findUnique({
      where: { id: newToAccountId },
      select: { balance: true },
    });

    if (newFromAccountBalance) {
      const correctedBalance = subtractMoney(
        newFromAccountBalance.balance,
        newAmount
      );
      await prisma.account.update({
        where: { id: newFromAccountId },
        data: { balance: correctedBalance },
      });
    }

    if (newToAccountBalance) {
      const correctedBalance = addMoney(newToAccountBalance.balance, newToAmount);
      await prisma.account.update({
        where: { id: newToAccountId },
        data: { balance: correctedBalance },
      });
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить перевод" };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const transaction = await prisma.transaction.findFirst({
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
      include: { account: true, transferFrom: true, transferTo: true },
    });

    if (!transaction) {
      return { error: "Транзакция не найдена или доступ запрещён" };
    }

    if (transaction.transferFrom || transaction.transferTo) {
      return { error: "Нельзя удалить транзакцию перевода напрямую" };
    }

    const account = transaction.account;
    let newBalance = account.balance;

    if (transaction.type === "income") {
      newBalance = subtractMoney(account.balance, transaction.amount);
    } else if (transaction.type === "expense") {
      newBalance = addMoney(account.balance, transaction.amount);
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    await prisma.transaction.delete({
      where: { id },
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить транзакцию" };
  }
}

export interface TransactionFilters {
  categoryIds?: string[];
  accountIds?: string[];
  minAmount?: string;
  maxAmount?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  types?: ("income" | "expense" | "transfer")[];
}

export async function getTransactions(
  workspaceId: string,
  filters?: TransactionFilters
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

    const where: any = {
      workspaceId,
    };

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      where.categoryId = { in: filters.categoryIds };
    }

    if (filters?.accountIds && filters.accountIds.length > 0) {
      where.accountId = { in: filters.accountIds };
    }

    if (filters?.types && filters.types.length > 0) {
      if (filters.types.length === 1) {
        where.type = filters.types[0];
      } else {
        where.type = { in: filters.types };
      }
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        where.date.gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        where.date.lte = dateTo;
      }
    }

    const transactions = await prisma.transaction.findMany({
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
        category: {
          select: {
            id: true,
            name: true,
            color: true,
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
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    let filteredTransactions = transactions;

    if (filters?.minAmount || filters?.maxAmount) {
      const minAmountNum = filters?.minAmount
        ? parseFloat(filters.minAmount)
        : undefined;
      const maxAmountNum = filters?.maxAmount
        ? parseFloat(filters.maxAmount)
        : undefined;

      filteredTransactions = transactions.filter((transaction) => {
        const amount = parseFloat(transaction.amount);
        if (isNaN(amount)) return false;

        if (minAmountNum !== undefined && amount < minAmountNum) {
          return false;
        }
        if (maxAmountNum !== undefined && amount > maxAmountNum) {
          return false;
        }
        return true;
      });
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase().trim();
      if (searchLower) {
        filteredTransactions = filteredTransactions.filter((transaction) => {
          const descriptionMatch =
            transaction.description?.toLowerCase().includes(searchLower);
          const categoryMatch = transaction.category?.name
            .toLowerCase()
            .includes(searchLower);
          return descriptionMatch || categoryMatch;
        });
      }
    }

    return { data: filteredTransactions };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить транзакции" };
  }
}

