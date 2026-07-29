import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, TelegramBotPreference } from "@prisma/client";

import { PrismaService } from "@/prisma/prisma.service";
import { runSerializableTransaction } from "@/prisma/serializable-transaction";

import { RECEIPT_MODE_CATEGORY, type ReceiptMode } from "./ai-finance.types";

function normalizeDefaultAccounts(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [workspaceId, accountId] of Object.entries(value)) {
    if (typeof accountId === "string") {
      result[workspaceId] = accountId;
    }
  }

  return result;
}

@Injectable()
export class AiFinancePreferenceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrCreatePreference(userId: string, telegramChatId?: string): Promise<TelegramBotPreference> {
    return this.prisma.telegramBotPreference.upsert({
      where: { userId },
      create: {
        userId,
        telegramChatId,
        receiptMode: RECEIPT_MODE_CATEGORY,
      },
      update: telegramChatId ? { telegramChatId } : {},
    });
  }

  async setActiveWorkspace(userId: string, workspaceId: string, telegramChatId?: string) {
    return this.prisma.telegramBotPreference.upsert({
      where: { userId },
      create: {
        userId,
        telegramChatId,
        activeWorkspaceId: workspaceId,
        receiptMode: RECEIPT_MODE_CATEGORY,
      },
      update: {
        telegramChatId,
        activeWorkspaceId: workspaceId,
      },
    });
  }

  async setDefaultAccount(userId: string, workspaceId: string, accountId: string, telegramChatId?: string) {
    return runSerializableTransaction(this.prisma, async (tx) => {
      const preference = await tx.telegramBotPreference.upsert({
        where: { userId },
        create: {
          userId,
          telegramChatId,
          receiptMode: RECEIPT_MODE_CATEGORY,
        },
        update: telegramChatId ? { telegramChatId } : {},
      });
      const defaults = normalizeDefaultAccounts(preference.defaultAccountByWorkspace);
      defaults[workspaceId] = accountId;

      return tx.telegramBotPreference.update({
        where: { userId },
        data: {
          telegramChatId,
          activeWorkspaceId: workspaceId,
          defaultAccountByWorkspace: defaults,
        },
      });
    });
  }

  async setReceiptMode(userId: string, receiptMode: ReceiptMode, telegramChatId?: string) {
    return this.prisma.telegramBotPreference.upsert({
      where: { userId },
      create: {
        userId,
        telegramChatId,
        receiptMode,
      },
      update: {
        telegramChatId,
        receiptMode,
      },
    });
  }

  getDefaultAccountId(preference: TelegramBotPreference, workspaceId: string | null | undefined) {
    if (!workspaceId) return null;
    return normalizeDefaultAccounts(preference.defaultAccountByWorkspace)[workspaceId] ?? null;
  }
}
