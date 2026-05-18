import type { Prisma } from "@prisma/client";

import {
  applyPaymentTransactionBalance,
  getTransferTransactionBalanceDeltas,
  revertPaymentTransactionBalance,
} from "@/shared/lib/balance-domain";
import { asAccountId, asMoneyAmount, asTransactionId, asWorkspaceId } from "@/shared/lib/domain-types";
import { prisma } from "@/shared/lib/prisma";
import type {
  CreatePaymentTransactionInput,
  CreateTransferTransactionInput,
  UpdatePaymentTransactionInput,
  UpdateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { PaymentTransactionType } from "./transaction.constants";

type PrismaTx = Prisma.TransactionClient;

async function getWorkspaceAccountOrThrow(
  tx: PrismaTx,
  workspaceId: string,
  accountId: string,
  errorMessage = "Счёт не найден"
) {
  const account = await tx.account.findFirst({
    where: {
      id: asAccountId(accountId),
      workspaceId: asWorkspaceId(workspaceId),
    },
  });

  if (!account) {
    throw new Error(errorMessage);
  }

  return account;
}

export async function createPaymentTransactionApplication(workspaceId: string, input: CreatePaymentTransactionInput) {
  const validated = {
    ...input,
    workspaceId: asWorkspaceId(workspaceId),
    accountId: asAccountId(input.accountId),
    amount: asMoneyAmount(input.amount),
  };

  return prisma.$transaction(async (tx) => {
    const account = await getWorkspaceAccountOrThrow(tx, validated.workspaceId, validated.accountId);

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
          workspaceId: validated.workspaceId,
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
        workspaceId: validated.workspaceId,
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
}

export async function createTransferTransactionApplication(
  workspaceId: string,
  userId: string,
  input: CreateTransferTransactionInput
) {
  const validated = {
    ...input,
    workspaceId: asWorkspaceId(workspaceId),
    fromAccountId: asAccountId(input.fromAccountId),
    toAccountId: asAccountId(input.toAccountId),
    amount: asMoneyAmount(input.amount),
    toAmount: asMoneyAmount(input.toAmount),
  };

  return prisma.$transaction(async (tx) => {
    const fromAccount = await getWorkspaceAccountOrThrow(tx, validated.workspaceId, validated.fromAccountId);
    const toAccount = await getWorkspaceAccountOrThrow(tx, validated.workspaceId, validated.toAccountId);

    if (fromAccount.id === toAccount.id) {
      throw new Error("Нельзя перевести на тот же счёт");
    }

    if (compareMoney(validated.amount, fromAccount.balance) > 0) {
      throw new Error(`Сумма отправления не может превышать баланс счёта (${fromAccount.balance})`);
    }

    const createdTransfer = await tx.transferTransaction.create({
      data: {
        workspaceId: validated.workspaceId,
        fromAccountId: validated.fromAccountId,
        toAccountId: validated.toAccountId,
        createdById: userId,
        amount: validated.amount,
        toAmount: validated.toAmount,
        description: validated.description,
        date: validated.date,
      },
    });

    const transferDeltas = getTransferTransactionBalanceDeltas(validated.amount, validated.toAmount);

    await tx.account.update({
      where: { id: validated.fromAccountId },
      data: { balance: addMoney(fromAccount.balance, transferDeltas.fromDelta) },
    });

    await tx.account.update({
      where: { id: validated.toAccountId },
      data: { balance: addMoney(toAccount.balance, transferDeltas.toDelta) },
    });

    return createdTransfer;
  });
}

export async function updatePaymentTransactionApplication(
  id: string,
  userId: string,
  input: UpdatePaymentTransactionInput
) {
  const transactionId = asTransactionId(id);
  const validated = {
    ...input,
    accountId: input.accountId ? asAccountId(input.accountId) : undefined,
    amount: input.amount ? asMoneyAmount(input.amount) : undefined,
  };

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findFirst({
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
      include: { account: true },
    });

    if (!transaction) {
      throw new Error("Транзакция не найдена или доступ запрещён");
    }

    const oldAccountId = asAccountId(transaction.accountId);
    const newAccountId = validated.accountId || oldAccountId;
    const accountChanged = oldAccountId !== newAccountId;

    const oldAmount = asMoneyAmount(transaction.amount.toString());
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
      where: { id: transactionId },
      data: validated,
    });
  });
}

export async function updateTransferTransactionApplication(
  id: string,
  userId: string,
  input: UpdateTransferTransactionInput
) {
  const transactionId = asTransactionId(id);
  const validated = {
    ...input,
    fromAccountId: asAccountId(input.fromAccountId),
    toAccountId: asAccountId(input.toAccountId),
    amount: asMoneyAmount(input.amount),
    toAmount: asMoneyAmount(input.toAmount),
  };

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.transferTransaction.findFirst({
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
        fromAccount: true,
        toAccount: true,
      },
    });

    if (!transfer) {
      throw new Error("Перевод не найден или доступ запрещён");
    }

    const oldFromAccount = transfer.fromAccount;
    const oldToAccount = transfer.toAccount;
    const oldAmount = asMoneyAmount(transfer.amount);
    const oldToAmount = asMoneyAmount(transfer.toAmount);

    const newFromAccountId = validated.fromAccountId || transfer.fromAccountId;
    const newToAccountId = validated.toAccountId || transfer.toAccountId;
    const newAmount = validated.amount || oldAmount;
    const newToAmount = validated.toAmount || oldToAmount;
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

    const revertedDeltas = getTransferTransactionBalanceDeltas(oldAmount, oldToAmount);

    await tx.account.update({
      where: { id: oldFromAccount.id },
      data: { balance: subtractMoney(oldFromAccountCurrent.balance, revertedDeltas.fromDelta) },
    });

    await tx.account.update({
      where: { id: oldToAccount.id },
      data: { balance: subtractMoney(oldToAccountCurrent.balance, revertedDeltas.toDelta) },
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
      where: { id: transactionId },
      data: {
        fromAccountId: newFromAccountId,
        toAccountId: newToAccountId,
        amount: newAmount,
        toAmount: newToAmount,
        description: newDescription,
        date: newDate,
      },
    });

    const nextDeltas = getTransferTransactionBalanceDeltas(newAmount, newToAmount);

    await tx.account.update({
      where: { id: newFromAccountId },
      data: { balance: addMoney(newFromAccountCurrent.balance, nextDeltas.fromDelta) },
    });

    await tx.account.update({
      where: { id: newToAccountId },
      data: { balance: addMoney(newToAccountCurrent.balance, nextDeltas.toDelta) },
    });
  });
}

export async function deleteTransferTransactionApplication(id: string, userId: string) {
  const transactionId = asTransactionId(id);

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.transferTransaction.findFirst({
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
        fromAccount: true,
        toAccount: true,
      },
    });

    if (!transfer) {
      throw new Error("Перевод не найден или доступ запрещён");
    }

    const transferDeltas = getTransferTransactionBalanceDeltas(transfer.amount, transfer.toAmount);

    await tx.account.update({
      where: { id: transfer.fromAccount.id },
      data: { balance: subtractMoney(transfer.fromAccount.balance, transferDeltas.fromDelta) },
    });

    await tx.account.update({
      where: { id: transfer.toAccount.id },
      data: { balance: subtractMoney(transfer.toAccount.balance, transferDeltas.toDelta) },
    });

    await tx.transferTransaction.delete({
      where: { id: transactionId },
    });
  });
}

export async function deletePaymentTransactionApplication(id: string, userId: string) {
  const transactionId = asTransactionId(id);

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findFirst({
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
      where: { id: transactionId },
    });
  });
}
