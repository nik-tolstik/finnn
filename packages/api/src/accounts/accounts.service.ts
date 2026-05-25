import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Account, Prisma, User } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import type { CreateAccountDto, UpdateAccountDto, UpdateAccountsOrderDto } from "./accounts.dto";

const ACCOUNT_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const ACCOUNT_WITH_OWNER_INCLUDE = {
  owner: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.AccountInclude;

const ARCHIVED_ACCOUNT_INCLUDE = {
  ...ACCOUNT_WITH_OWNER_INCLUDE,
  _count: {
    select: {
      paymentTransactions: true,
      outgoingTransfers: true,
      incomingTransfers: true,
      debts: true,
      debtTransactions: true,
    },
  },
} satisfies Prisma.AccountInclude;

type AccountWithOwner = Account & {
  owner?: Pick<User, "id" | "name" | "email" | "image"> | null;
};

type ArchivedAccountWithCounts = AccountWithOwner & {
  _count: {
    paymentTransactions: number;
    outgoingTransfers: number;
    incomingTransfers: number;
    debts: number;
    debtTransactions: number;
  };
};

type AccountDependencyCounts = {
  transactions: number;
  debts: number;
  debtTransactions: number;
};

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toAccountDto(account: AccountWithOwner) {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    ownerId: account.ownerId,
    name: account.name,
    balance: account.balance,
    currency: account.currency,
    description: account.description,
    color: account.color,
    icon: account.icon,
    archived: account.archived,
    order: account.order,
    createdAt: toIsoString(account.createdAt),
    updatedAt: toIsoString(account.updatedAt),
    owner: account.owner ?? null,
  };
}

function getArchivedAccountDependencyCounts(account: ArchivedAccountWithCounts): AccountDependencyCounts {
  return {
    transactions:
      account._count.paymentTransactions + account._count.outgoingTransfers + account._count.incomingTransfers,
    debts: account._count.debts,
    debtTransactions: account._count.debtTransactions,
  };
}

function toArchivedAccountDto(account: ArchivedAccountWithCounts) {
  return {
    ...toAccountDto(account),
    _count: getArchivedAccountDependencyCounts(account),
  };
}

function formatAccountDependencyBreakdown(counts: AccountDependencyCounts) {
  const parts: string[] = [];

  if (counts.transactions > 0) parts.push(`транзакции (${counts.transactions})`);
  if (counts.debts > 0) parts.push(`долги (${counts.debts})`);
  if (counts.debtTransactions > 0) parts.push(`долговые операции (${counts.debtTransactions})`);

  return parts.join(", ");
}

@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async assertWorkspaceAccess(workspaceId: string, currentUser: AuthenticatedUser) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (workspace.ownerId === currentUser.id) {
      return;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("Доступ запрещён");
    }
  }

  private async getAccessibleAccount(accountId: string, currentUser: AuthenticatedUser, includeArchived = false) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: ACCOUNT_WITH_OWNER_INCLUDE,
    });

    if (!account || (!includeArchived && account.archived)) {
      throw new NotFoundException("Счёт не найден");
    }

    await this.assertWorkspaceAccess(account.workspaceId, currentUser);
    return account;
  }

  private async getAccountDependencyCounts(accountId: string): Promise<AccountDependencyCounts> {
    const [paymentTransactions, outgoingTransfers, incomingTransfers, debts, debtTransactions] = await Promise.all([
      this.prisma.paymentTransaction.count({ where: { accountId } }),
      this.prisma.transferTransaction.count({ where: { fromAccountId: accountId } }),
      this.prisma.transferTransaction.count({ where: { toAccountId: accountId } }),
      this.prisma.debt.count({ where: { accountId } }),
      this.prisma.debtTransaction.count({ where: { accountId } }),
    ]);

    return {
      transactions: paymentTransactions + outgoingTransfers + incomingTransfers,
      debts,
      debtTransactions,
    };
  }

  async createAccount(workspaceId: string, input: CreateAccountDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const accountsCount = await this.prisma.account.count({
      where: { workspaceId, archived: false },
    });

    const account = await this.prisma.account.create({
      data: {
        name: input.name,
        balance: input.balance,
        currency: input.currency,
        color: input.color,
        icon: input.icon,
        ownerId: input.ownerId ?? null,
        workspaceId,
        order: accountsCount,
        createdAt: input.createdAt,
      },
      include: ACCOUNT_WITH_OWNER_INCLUDE,
    });

    return { account: toAccountDto(account) };
  }

  async listAccounts(workspaceId: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const accounts = await this.prisma.account.findMany({
      where: {
        workspaceId,
        archived: false,
      },
      include: ACCOUNT_WITH_OWNER_INCLUDE,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return { accounts: accounts.map(toAccountDto) };
  }

  async getAccount(accountId: string, currentUser: AuthenticatedUser) {
    const account = await this.getAccessibleAccount(accountId, currentUser);
    return { account: toAccountDto(account) };
  }

  async updateAccount(accountId: string, input: UpdateAccountDto, currentUser: AuthenticatedUser) {
    await this.getAccessibleAccount(accountId, currentUser);

    const updateData: Prisma.AccountUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.balance !== undefined) updateData.balance = input.balance;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.ownerId !== undefined)
      updateData.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
    if (input.color !== undefined) updateData.color = input.color;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.createdAt !== undefined) updateData.createdAt = input.createdAt;
    if (input.order !== undefined) updateData.order = input.order;

    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: updateData,
      include: ACCOUNT_WITH_OWNER_INCLUDE,
    });

    return { account: toAccountDto(account) };
  }

  async updateAccountsOrder(workspaceId: string, input: UpdateAccountsOrderDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    await this.prisma.$transaction(
      input.accountOrders.map(({ id, order }) =>
        this.prisma.account.updateMany({
          where: {
            id,
            workspaceId,
            archived: false,
          },
          data: { order },
        })
      )
    );

    return { success: true };
  }

  async archiveAccount(accountId: string, currentUser: AuthenticatedUser) {
    const account = await this.getAccessibleAccount(accountId, currentUser, true);

    if (!account.archived) {
      await this.prisma.account.update({
        where: { id: accountId },
        data: { archived: true },
      });
    }

    return { success: true };
  }

  async listArchivedAccounts(workspaceId: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const accounts = await this.prisma.account.findMany({
      where: {
        workspaceId,
        archived: true,
      },
      include: ARCHIVED_ACCOUNT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return { accounts: accounts.map(toArchivedAccountDto) };
  }

  async unarchiveAccount(accountId: string, currentUser: AuthenticatedUser) {
    const account = await this.getAccessibleAccount(accountId, currentUser, true);

    if (account.archived) {
      const accountsCount = await this.prisma.account.count({
        where: { workspaceId: account.workspaceId, archived: false },
      });

      await this.prisma.account.update({
        where: { id: accountId },
        data: { archived: false, order: accountsCount },
      });
    }

    return { success: true };
  }

  async deleteArchivedAccount(accountId: string, currentUser: AuthenticatedUser) {
    const account = await this.getAccessibleAccount(accountId, currentUser, true);

    if (!account.archived) {
      throw new BadRequestException("Можно удалить только архивный счёт");
    }

    const dependencyCounts = await this.getAccountDependencyCounts(account.id);
    if (Object.values(dependencyCounts).some((count) => count > 0)) {
      const dependencyBreakdown = formatAccountDependencyBreakdown(dependencyCounts);
      throw new BadRequestException(`Нельзя удалить счёт из архива: у счёта есть связанные ${dependencyBreakdown}.`);
    }

    await this.prisma.account.delete({
      where: { id: accountId },
    });
  }
}
