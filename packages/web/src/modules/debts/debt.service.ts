"use server";

import type { Prisma } from "@prisma/client";

import { fail, ok, success } from "@/shared/lib/action-result";
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

import {
  addToDebtApplication,
  closeDebtApplication,
  createDebtApplication,
  deleteDebtApplication,
  deleteDebtTransactionApplication,
  updateDebtApplication,
  updateDebtTransactionApplication,
} from "./debt.application";
import { type DebtStatus, DebtTransactionType, type DebtType } from "./debt.constants";
import type { DebtWithRelations } from "./debt.types";

export async function createDebt(workspaceId: string, input: CreateDebtInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createDebtSchema.parse(input);
    const debt = await createDebtApplication(workspaceId, validated);

    revalidateDebtRoutes();
    return ok(debt);
  } catch (error: unknown) {
    return fail(error, "Не удалось создать долг");
  }
}

export async function closeDebt(id: string, input: CloseDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = closeDebtSchema.parse(input);
    const updatedDebt = await closeDebtApplication(id, userId, validated);

    revalidateDebtRoutes();
    return ok(updatedDebt);
  } catch (error: unknown) {
    return fail(error, "Не удалось закрыть долг");
  }
}

export async function addToDebt(id: string, input: AddToDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = addToDebtSchema.parse(input);
    const updatedDebt = await addToDebtApplication(id, userId, validated);

    revalidateDebtRoutes();
    return ok(updatedDebt);
  } catch (error: unknown) {
    return fail(error, "Не удалось добавить к долгу");
  }
}

export async function deleteDebt(id: string) {
  try {
    const userId = await requireUserId();

    await deleteDebtApplication(id, userId);

    revalidateDebtRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить долг");
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
      return ok({
        personName: debt.personName,
        initialAmount: debt.amount,
        initialDate: debt.date.toISOString(),
        currency: debt.currency,
      });
    }

    return ok({
      personName: debt.personName,
      initialAmount: createdTransaction.amount,
      initialDate: createdTransaction.date.toISOString(),
      currency: debt.currency,
    });
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить данные");
  }
}

export async function updateDebt(debtId: string, input: UpdateDebtInput) {
  try {
    const userId = await requireUserId();
    const validated = updateDebtSchema.parse(input);
    const updatedDebt = await updateDebtApplication(debtId, userId, validated);

    revalidateDebtRoutes();
    return ok(updatedDebt);
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить долг");
  }
}

export async function updateDebtTransaction(id: string, input: UpdateDebtTransactionInput) {
  try {
    const userId = await requireUserId();
    const validated = updateDebtTransactionSchema.parse(input);
    const updatedDebtTransaction = await updateDebtTransactionApplication(id, userId, validated);

    revalidateDebtRoutes();
    return ok(updatedDebtTransaction);
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить транзакцию долга");
  }
}

export async function deleteDebtTransaction(id: string) {
  try {
    const userId = await requireUserId();

    const deleted = await deleteDebtTransactionApplication(id, userId);

    revalidateDebtRoutes();
    return deleted;
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить транзакцию долга");
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
