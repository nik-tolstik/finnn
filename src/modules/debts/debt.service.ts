"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
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

    await prisma.debtTransaction.create({
      data: {
        workspaceId,
        debtId: debt.id,
        accountId,
        type: DebtTransactionType.CREATED,
        amount: validated.amount,
        date: validated.date,
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
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

    const currenciesMatch = validated.accountId
      ? (await prisma.account.findUnique({ where: { id: validated.accountId } }))?.currency === debt.currency
      : true;

    await prisma.debtTransaction.create({
      data: {
        workspaceId: debt.workspaceId,
        debtId: debt.id,
        accountId: validated.useAccount ? validated.accountId : null,
        type: DebtTransactionType.CLOSED,
        amount: validated.amount,
        toAmount: !currenciesMatch ? validated.toAmount : null,
        date: new Date(),
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
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

    await prisma.debtTransaction.create({
      data: {
        workspaceId: debt.workspaceId,
        debtId: debt.id,
        accountId: validated.useAccount && debt.accountId ? debt.accountId : null,
        type: DebtTransactionType.ADDED,
        amount: validated.amount,
        date: new Date(),
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
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

export async function getDebtEditData(debtId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
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
      return { error: "Нельзя редактировать закрытый долг" };
    }

    let initialTransaction = await prisma.debtTransaction.findFirst({
      where: {
        debtId,
        type: DebtTransactionType.CREATED,
      },
    });

    if (!initialTransaction) {
      const firstByDate = await prisma.debtTransaction.findFirst({
        where: { debtId },
        orderBy: { date: "asc" },
      });
      if (!firstByDate) {
        const validated = updateDebtSchema.parse(input);
        const oldInitial = debt.amount;
        const amountDelta = subtractMoney(validated.amount, oldInitial);
        const newRemaining = addMoney(debt.remainingAmount, amountDelta);
        if (compareMoney(newRemaining, "0") < 0) {
          return {
            error: `Новая изначальная сумма не может быть меньше ${subtractMoney(oldInitial, debt.remainingAmount)} (остаток долга учтён)`,
          };
        }
    if (debt.accountId && compareMoney(validated.amount, oldInitial) !== 0) {
      const account = await prisma.account.findUnique({ where: { id: debt.accountId } });
      if (account) {
        if (debt.type === DebtType.LENT) {
          if (compareMoney(amountDelta, "0") > 0 && compareMoney(account.balance, amountDelta) < 0) {
            return { error: `Сумма не может превышать баланс счёта (${account.balance})` };
          }
          await prisma.account.update({
            where: { id: debt.accountId },
            data: { balance: subtractMoney(account.balance, amountDelta) },
          });
        } else {
          if (compareMoney(amountDelta, "0") < 0 && compareMoney(account.balance, subtractMoney("0", amountDelta)) < 0) {
            return { error: `Недостаточно средств на счёте (${account.balance})` };
          }
          await prisma.account.update({
            where: { id: debt.accountId },
            data: { balance: addMoney(account.balance, amountDelta) },
          });
        }
      }
    }
    await prisma.debt.update({
      where: { id: debtId },
      data: {
        personName: validated.personName,
        date: validated.date,
        amount: addMoney(debt.amount, amountDelta),
        remainingAmount: addMoney(debt.remainingAmount, amountDelta),
      },
    });
    await prisma.debtTransaction.create({
          data: {
            workspaceId: debt.workspaceId,
            debtId,
            accountId: debt.accountId,
            type: DebtTransactionType.CREATED,
            amount: validated.amount,
            date: validated.date,
          },
        });
        revalidatePath("/debts");
        revalidatePath("/dashboard");
        revalidatePath("/transactions");
        return { data: debt };
      }
      initialTransaction = firstByDate;
    }

    const validated = updateDebtSchema.parse(input);
    const oldInitial = initialTransaction.amount;
    const amountDelta = subtractMoney(validated.amount, oldInitial);
    const newRemaining = addMoney(debt.remainingAmount, amountDelta);

    if (compareMoney(newRemaining, "0") < 0) {
      return {
        error: `Новая изначальная сумма не может быть меньше ${subtractMoney(oldInitial, debt.remainingAmount)} (остаток долга учтён)`,
      };
    }

    if (debt.accountId && compareMoney(validated.amount, oldInitial) !== 0) {
      const account = await prisma.account.findUnique({ where: { id: debt.accountId } });
      if (account) {
        if (debt.type === DebtType.LENT) {
          if (compareMoney(amountDelta, "0") > 0 && compareMoney(account.balance, amountDelta) < 0) {
            return { error: `Сумма не может превышать баланс счёта (${account.balance})` };
          }
          await prisma.account.update({
            where: { id: debt.accountId },
            data: { balance: subtractMoney(account.balance, amountDelta) },
          });
        } else {
          if (compareMoney(amountDelta, "0") < 0 && compareMoney(account.balance, subtractMoney("0", amountDelta)) < 0) {
            return { error: `Недостаточно средств на счёте (${account.balance})` };
          }
          await prisma.account.update({
            where: { id: debt.accountId },
            data: { balance: addMoney(account.balance, amountDelta) },
          });
        }
      }
    }

    await prisma.debt.update({
      where: { id: debtId },
      data: {
        personName: validated.personName,
        date: validated.date,
        amount: addMoney(debt.amount, amountDelta),
        remainingAmount: addMoney(debt.remainingAmount, amountDelta),
      },
    });

    await prisma.debtTransaction.update({
      where: { id: initialTransaction.id },
      data: {
        amount: validated.amount,
        date: validated.date,
      },
    });

    revalidatePath("/debts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { data: debt };
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
