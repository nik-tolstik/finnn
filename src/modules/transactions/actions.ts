"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createTransactionSchema,
  createTransferSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type CreateTransferInput,
  type UpdateTransactionInput,
} from "@/shared/lib/validations/transaction";
import { revalidatePath } from "next/cache";
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

    const transaction = await prisma.transaction.create({
      data: {
        workspaceId,
        accountId: validated.accountId,
        amount: validated.amount,
        type: validated.type,
        description: validated.description,
        date: validated.date,
        categoryId: validated.categoryId,
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
        amount: validated.amount,
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
      },
    });

    await prisma.account.update({
      where: { id: validated.fromAccountId },
      data: { balance: subtractMoney(fromAccount.balance, validated.amount) },
    });

    await prisma.account.update({
      where: { id: validated.toAccountId },
      data: { balance: addMoney(toAccount.balance, validated.amount) },
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

export async function getTransactions(workspaceId: string, accountId?: string) {
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

    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        ...(accountId && { accountId }),
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return { data: transactions };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить транзакции" };
  }
}

