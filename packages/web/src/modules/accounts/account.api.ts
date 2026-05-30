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
import type {
  CreateAccountInput,
  UpdateAccountInput,
  UpdateAccountsOrderInput,
} from "@/shared/lib/validations/account";

function toUiAccount(account: AccountDto) {
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

function toUiArchivedAccount(account: ArchivedAccountDto) {
  return {
    ...toUiAccount(account),
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

export async function createAccount(workspaceId: string, input: CreateAccountInput, options?: RequestInit) {
  try {
    const response = await createApiAccount(workspaceId, toCreateAccountDto(input), options);
    return ok(toUiAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать счёт");
  }
}

export async function updateAccount(id: string, input: UpdateAccountInput, options?: RequestInit) {
  try {
    const response = await updateApiAccount(id, toUpdateAccountDto(input), options);
    return ok(toUiAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить счёт");
  }
}

export async function archiveAccount(id: string, options?: RequestInit) {
  try {
    await archiveApiAccount(id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось архивировать счёт");
  }
}

export async function getAccounts(workspaceId: string, options?: RequestInit) {
  try {
    const response = await listApiAccounts(workspaceId, options);
    return ok(response.accounts.map(toUiAccount));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить счета");
  }
}

export async function getAccount(id: string, options?: RequestInit) {
  try {
    const response = await getApiAccount(id, options);
    return ok(toUiAccount(response.account));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить счёт");
  }
}

export async function updateAccountsOrder(workspaceId: string, input: UpdateAccountsOrderInput, options?: RequestInit) {
  try {
    await updateApiAccountsOrder(workspaceId, input, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить порядок счетов");
  }
}

export async function getArchivedAccounts(workspaceId: string, options?: RequestInit) {
  try {
    const response = await listApiArchivedAccounts(workspaceId, options);
    return ok(response.accounts.map(toUiArchivedAccount));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить архивированные счета");
  }
}

export async function unarchiveAccount(id: string, options?: RequestInit) {
  try {
    await unarchiveApiAccount(id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить счёт из архива");
  }
}

export async function deleteArchivedAccount(id: string, options?: RequestInit) {
  try {
    await deleteApiArchivedAccount(id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить архивный счёт");
  }
}
