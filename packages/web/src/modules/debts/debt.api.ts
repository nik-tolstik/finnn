import {
  addToDebt as addToApiDebt,
  closeDebt as closeApiDebt,
  createDebt as createApiDebt,
  deleteDebt as deleteApiDebt,
  deleteDebtTransaction as deleteApiDebtTransaction,
  getDebtEditData as getApiDebtEditData,
  listDebts as listApiDebts,
  updateDebt as updateApiDebt,
  updateDebtTransaction as updateApiDebtTransaction,
} from "@/shared/api/generated/debts/debts";
import type {
  AddToDebtDto,
  CloseDebtDto,
  CreateDebtDto,
  DebtAccountDto,
  DebtAccountWithOwnerDto,
  DebtDto,
  DebtEntryTransactionDto,
  ListDebtsParams,
  UpdateDebtDto,
  UpdateDebtEntryTransactionDto,
} from "@/shared/api/generated/model";
import { fail, ok, success } from "@/shared/lib/action-result";
import type {
  AddToDebtInput,
  CloseDebtInput,
  CreateDebtInput,
  UpdateDebtInput,
  UpdateDebtTransactionInput,
} from "@/shared/lib/validations/debt";

import type { DebtStatus, DebtType } from "./debt.constants";
import type { DebtTransactionWithRelations, DebtWithRelations } from "./debt.types";

type ApiOwner = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  image?: unknown;
};

function toDate(value: string) {
  return new Date(value);
}

function toUiDebtAccount(account?: DebtAccountDto | null) {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color ?? null,
    icon: account.icon ?? null,
  };
}

function toUiDebtAccountWithOwner(account?: DebtAccountWithOwnerDto | null) {
  if (!account) {
    return null;
  }

  const owner = account.owner as ApiOwner | null | undefined;

  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color ?? null,
    icon: account.icon ?? null,
    ownerId: account.ownerId ?? null,
    owner:
      owner && typeof owner.id === "string" && typeof owner.email === "string"
        ? {
            id: owner.id,
            name: typeof owner.name === "string" ? owner.name : null,
            email: owner.email,
            image: typeof owner.image === "string" ? owner.image : null,
          }
        : null,
  };
}

function toUiDebt(debt: DebtDto): DebtWithRelations {
  return {
    ...debt,
    accountId: debt.accountId ?? null,
    date: toDate(debt.date),
    createdAt: toDate(debt.createdAt),
    updatedAt: toDate(debt.updatedAt),
    account: toUiDebtAccount(debt.account),
  };
}

function toUiDebtTransaction(transaction: DebtEntryTransactionDto): DebtTransactionWithRelations {
  return {
    ...transaction,
    accountId: transaction.accountId ?? null,
    toAmount: transaction.toAmount ?? null,
    date: toDate(transaction.date),
    createdAt: toDate(transaction.createdAt),
    debt: {
      ...transaction.debt,
      accountId: transaction.debt.accountId ?? null,
      date: toDate(transaction.debt.date),
      createdAt: toDate(transaction.debt.createdAt),
      updatedAt: toDate(transaction.debt.updatedAt),
    },
    account: toUiDebtAccountWithOwner(transaction.account),
  };
}

function toCreateDebtDto(input: CreateDebtInput): CreateDebtDto {
  return {
    type: input.type as CreateDebtDto["type"],
    personName: input.personName,
    amount: input.amount,
    date: input.date.toISOString(),
    useAccount: input.useAccount,
    accountId: input.accountId,
    currency: input.currency,
  };
}

function toCloseDebtDto(input: CloseDebtInput): CloseDebtDto {
  return {
    amount: input.amount,
    toAmount: input.toAmount,
    paymentAmount: input.paymentAmount,
    categoryId: input.categoryId,
    closeEarly: input.closeEarly,
    accountId: input.accountId,
    useAccount: input.useAccount,
  };
}

function toAddToDebtDto(input: AddToDebtInput): AddToDebtDto {
  return {
    amount: input.amount,
    useAccount: input.useAccount,
  };
}

function toUpdateDebtDto(input: UpdateDebtInput): UpdateDebtDto {
  return {
    personName: input.personName,
    amount: input.amount,
    date: input.date.toISOString(),
  };
}

function toUpdateDebtTransactionDto(input: UpdateDebtTransactionInput): UpdateDebtEntryTransactionDto {
  return {
    amount: input.amount,
    toAmount: input.toAmount,
    accountId: input.accountId,
    date: input.date.toISOString(),
  };
}

function toListDebtsParams(filters?: DebtFilters): ListDebtsParams | undefined {
  if (!filters) {
    return undefined;
  }

  return {
    status: filters.status,
    type: filters.type,
    personName: filters.personName,
  };
}

export async function createDebt(workspaceId: string, input: CreateDebtInput, options?: RequestInit) {
  try {
    const response = await createApiDebt(workspaceId, toCreateDebtDto(input), options);
    return ok(toUiDebt(response.debt));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать долг");
  }
}

export async function closeDebt(id: string, input: CloseDebtInput, options?: RequestInit) {
  try {
    const response = await closeApiDebt(id, toCloseDebtDto(input), options);
    return ok(toUiDebt(response.debt));
  } catch (error: unknown) {
    return fail(error, "Не удалось закрыть долг");
  }
}

export async function addToDebt(id: string, input: AddToDebtInput, options?: RequestInit) {
  try {
    const response = await addToApiDebt(id, toAddToDebtDto(input), options);
    return ok(toUiDebt(response.debt));
  } catch (error: unknown) {
    return fail(error, "Не удалось добавить к долгу");
  }
}

export async function deleteDebt(id: string, options?: RequestInit) {
  try {
    await deleteApiDebt(id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить долг");
  }
}

export async function getDebtEditData(debtId: string, options?: RequestInit) {
  try {
    const response = await getApiDebtEditData(debtId, options);
    return ok(response.debt);
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить данные");
  }
}

export async function updateDebt(debtId: string, input: UpdateDebtInput, options?: RequestInit) {
  try {
    const response = await updateApiDebt(debtId, toUpdateDebtDto(input), options);
    return ok(toUiDebt(response.debt));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить долг");
  }
}

export async function updateDebtTransaction(id: string, input: UpdateDebtTransactionInput, options?: RequestInit) {
  try {
    const response = await updateApiDebtTransaction(id, toUpdateDebtTransactionDto(input), options);
    return ok(toUiDebtTransaction(response.debtTransaction));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить транзакцию долга");
  }
}

export async function deleteDebtTransaction(id: string, options?: RequestInit) {
  try {
    await deleteApiDebtTransaction(id, options);
    return success();
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
  filters?: DebtFilters,
  options?: RequestInit
): Promise<{ data: DebtWithRelations[]; total: number }> {
  try {
    const response = await listApiDebts(workspaceId, toListDebtsParams(filters), options);
    return { data: response.data.map(toUiDebt), total: response.total };
  } catch {
    throw new Error("Не удалось загрузить долги");
  }
}
