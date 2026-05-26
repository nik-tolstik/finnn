"use server";

import {
  archiveAccount as archiveApiAccount,
  createAccount as createApiAccount,
  deleteArchivedAccount as deleteApiArchivedAccount,
  getAccount as getApiAccount,
  listAccounts as listApiAccounts,
  listArchivedAccounts as listApiArchivedAccounts,
  unarchiveAccount as unarchiveApiAccount,
  updateAccount as updateApiAccount,
  updateAccountsOrder as updateApiAccountsOrder,
} from "@/shared/api/generated/accounts/accounts";
import type { AccountDto, ArchivedAccountDto, CreateAccountDto, UpdateAccountDto } from "@/shared/api/generated/model";
import { fail, ok, success } from "@/shared/lib/action-result";
import { getServerApiRequestOptions } from "@/shared/lib/api-session";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import type {
  CreateAccountInput,
  UpdateAccountInput,
  UpdateAccountsOrderInput,
} from "@/shared/lib/validations/account";

function toLegacyAccount(account: AccountDto) {
  const owner = account.owner
    ? {
        id: account.owner.id,
        name: account.owner.name,
        email: account.owner.email,
        image: account.owner.image ?? null,
      }
    : null;

  return {
    ...account,
    ownerId: account.ownerId ?? null,
    description: account.description ?? null,
    color: account.color ?? null,
    icon: account.icon ?? null,
    owner,
    createdAt: new Date(account.createdAt),
    updatedAt: new Date(account.updatedAt),
  };
}

function toLegacyArchivedAccount(account: ArchivedAccountDto) {
  return {
    ...toLegacyAccount(account),
    _count: account._count,
  };
}

function toCreateAccountDto(input: CreateAccountInput): CreateAccountDto {
  return {
    name: input.name,
    balance: input.balance,
    currency: input.currency as CreateAccountDto["currency"],
    ownerId: input.ownerId ?? null,
    color: input.color,
    icon: input.icon,
    createdAt: input.createdAt.toISOString(),
  };
}

function toUpdateAccountDto(input: UpdateAccountInput): UpdateAccountDto {
  return {
    name: input.name,
    balance: input.balance,
    currency: input.currency as UpdateAccountDto["currency"],
    ownerId: input.ownerId,
    color: input.color,
    icon: input.icon,
    createdAt: input.createdAt?.toISOString(),
    order: input.order,
  };
}

export async function createAccount(workspaceId: string, input: CreateAccountInput) {
  try {
    const response = await createApiAccount(workspaceId, toCreateAccountDto(input), await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return ok(toLegacyAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать счёт");
  }
}

export async function updateAccount(id: string, input: UpdateAccountInput) {
  try {
    const response = await updateApiAccount(id, toUpdateAccountDto(input), await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return ok(toLegacyAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить счёт");
  }
}

export async function archiveAccount(id: string) {
  try {
    await archiveApiAccount(id, await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось архивировать счёт");
  }
}

export async function getAccounts(workspaceId: string) {
  try {
    const response = await listApiAccounts(workspaceId, await getServerApiRequestOptions());
    return ok(response.accounts.map(toLegacyAccount));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить счета");
  }
}

export async function getAccount(id: string) {
  try {
    const response = await getApiAccount(id, await getServerApiRequestOptions());
    return ok(toLegacyAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить счёт");
  }
}

export async function updateAccountsOrder(workspaceId: string, input: UpdateAccountsOrderInput) {
  try {
    await updateApiAccountsOrder(workspaceId, input, await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить порядок счетов");
  }
}

export async function getArchivedAccounts(workspaceId: string) {
  try {
    const response = await listApiArchivedAccounts(workspaceId, await getServerApiRequestOptions());
    return ok(response.accounts.map(toLegacyArchivedAccount));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить архивированные счета");
  }
}

export async function unarchiveAccount(id: string) {
  try {
    await unarchiveApiAccount(id, await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить счёт из архива");
  }
}

export async function deleteArchivedAccount(id: string) {
  try {
    await deleteApiArchivedAccount(id, await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить архивный счёт");
  }
}
