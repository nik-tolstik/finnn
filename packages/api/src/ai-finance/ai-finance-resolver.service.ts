import { Inject, Injectable } from "@nestjs/common";
import type { Account, Category, TelegramBotPreference, Workspace } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { addMoney } from "@/common/money";
import { PrismaService } from "@/prisma/prisma.service";

import {
  type AiFinanceDraftPayload,
  type AiFinanceExtraction,
  type AiFinancePaymentEntry,
  type AiFinanceQuestion,
  type AiFinanceSourceType,
  type AiFinanceTransferEntry,
  RECEIPT_MODE_CATEGORY,
  RECEIPT_MODE_ITEMS,
  RECEIPT_MODE_SINGLE,
  type ReceiptMode,
} from "./ai-finance.types";
import type { AiFinanceConversationAction } from "./ai-finance-parser.service";
import { AiFinancePreferenceService } from "./ai-finance-preference.service";

const MONEY_PATTERN = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

function normalizeHint(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function includesHint(name: string, hint: string | null) {
  if (!hint) return false;

  const normalizedName = name.toLowerCase();
  if (normalizedName.includes(hint) || hint.includes(normalizedName)) return true;

  const cashHints = ["cash", "налич", "наличные", "наличными"];
  const cashAccountHints = ["cash", "налич"];
  if (cashHints.some((value) => hint.includes(value))) {
    return cashAccountHints.some((value) => normalizedName.includes(value));
  }

  const cardHints = ["card", "карта", "карте", "картой", "карту"];
  const cardAccountHints = ["card", "bank", "банк"];
  if (cardHints.some((value) => hint.includes(value))) {
    return cardAccountHints.some((value) => normalizedName.includes(value));
  }

  return false;
}

function isExactCatalogName(name: string, value: string | null | undefined) {
  return Boolean(value && name.trim().toLowerCase() === value.trim().toLowerCase());
}

function isMoney(value: string | null | undefined): value is string {
  return Boolean(value && MONEY_PATTERN.test(value));
}

const EDIT_STOP_WORDS = new Set([
  "в",
  "на",
  "по",
  "из",
  "к",
  "ко",
  "с",
  "со",
  "перемести",
  "перенеси",
  "поставь",
  "поменяй",
  "измени",
  "категорию",
  "категория",
]);

function getEditWords(value: string | null | undefined) {
  return (normalizeHint(value)?.match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length > 2 && !EDIT_STOP_WORDS.has(word)
  );
}

function startOfToday(timezone: string) {
  const now = new Date();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${localDate}T12:00:00.000Z`);
}

function parseDateText(
  dateText: string | null | undefined,
  timezone: string,
  allowTodayDefault: boolean
): string | null {
  const text = dateText?.trim().toLowerCase();
  const today = startOfToday(timezone);

  if (!text) {
    return allowTodayDefault ? today.toISOString() : null;
  }

  if (text === "today" || text === "сегодня") {
    return today.toISOString();
  }

  if (text === "yesterday" || text === "вчера") {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString();
  }

  const daysAgoMatch = text.match(/(\d+)\s+(?:days?\s+ago|дн(?:я|ей|ь)?\s+назад)/);
  if (daysAgoMatch) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - Number(daysAgoMatch[1]));
    return date.toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getFirstQuestion(missingFields: string[]): AiFinanceQuestion | null {
  const order: AiFinanceQuestion[] = ["workspace", "account", "date", "preview"];
  return order.find((question) => missingFields.includes(question)) ?? null;
}

function normalizeReceiptMode(value: string | null | undefined): ReceiptMode {
  if (value === RECEIPT_MODE_SINGLE || value === RECEIPT_MODE_ITEMS || value === RECEIPT_MODE_CATEGORY) {
    return value;
  }

  return RECEIPT_MODE_CATEGORY;
}

@Injectable()
export class AiFinanceResolverService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiFinancePreferenceService) private readonly preferences: AiFinancePreferenceService
  ) {}

  async resolveInitial(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    sourceType: AiFinanceSourceType;
    sourceText?: string;
    extraction: AiFinanceExtraction;
  }) {
    const preference = await this.preferences.getOrCreatePreference(input.user.id, input.telegramChatId);
    return this.resolveFromParts({
      user: input.user,
      telegramChatId: input.telegramChatId,
      sourceType: input.sourceType,
      sourceText: input.sourceText,
      extraction: input.extraction,
      preference,
      receiptMode: (input.extraction.kind === "receipt" ? preference.receiptMode : null) as ReceiptMode | null,
    });
  }

  async applyAnswer(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    payload: AiFinanceDraftPayload;
    sourceType: AiFinanceSourceType;
    sourceText?: string | null;
    currentQuestion?: string | null;
    answer: string;
    receiptMode?: ReceiptMode | null;
    workspaceId?: string | null;
  }) {
    const preference = await this.preferences.getOrCreatePreference(input.user.id, input.telegramChatId);
    const answer = input.answer.trim();
    const extraction = { ...input.payload.extraction };

    if (input.currentQuestion === "date") {
      if (
        extraction.kind === "payment" ||
        extraction.kind === "payments" ||
        extraction.kind === "receipt" ||
        extraction.kind === "transfer"
      ) {
        extraction.dateText = answer;
      }
    } else if (input.currentQuestion === "account") {
      if (extraction.kind === "payment" || extraction.kind === "receipt") {
        extraction.accountHint = answer;
      } else if (extraction.kind === "payments") {
        extraction.payments = extraction.payments.map((payment) => ({ ...payment, accountHint: answer }));
      } else if (extraction.kind === "transfer") {
        extraction.fromAccountHint = answer;
      }
    }

    return this.resolveFromParts({
      user: input.user,
      telegramChatId: input.telegramChatId,
      sourceType: input.sourceType,
      sourceText: input.sourceText ?? undefined,
      extraction,
      preference,
      receiptMode: input.receiptMode ?? input.payload.receiptMode ?? normalizeReceiptMode(preference.receiptMode),
      forcedWorkspaceId: input.workspaceId ?? undefined,
    });
  }

  async applyDraftEdit(input: {
    payload: AiFinanceDraftPayload;
    workspaceId?: string | null;
    answer: string;
    receiptMode?: ReceiptMode | null;
  }) {
    const entries = input.payload.entries ?? [];
    const categories = input.workspaceId ? await this.getWorkspaceCategories(input.workspaceId) : [];
    const targetIndex = this.findDraftEntryIndex(entries, input.answer);
    const targetEntry = targetIndex >= 0 ? entries[targetIndex] : entries.length === 1 ? entries[0] : null;
    const targetEntryIndex = targetIndex >= 0 ? targetIndex : entries.length === 1 ? 0 : -1;
    const category = targetEntry ? this.resolveCategory(categories, input.answer, targetEntry.type) : null;

    if (!targetEntry || targetEntryIndex < 0 || !category) {
      return {
        workspaceId: input.workspaceId ?? null,
        receiptMode: input.receiptMode ?? input.payload.receiptMode ?? null,
        payload: input.payload,
        missingFields: [],
        currentQuestion: null,
        kind: input.payload.extraction.kind,
        confidence: input.payload.extraction.confidence,
      };
    }

    const nextEntries = entries.map((entry, index) =>
      index === targetEntryIndex
        ? {
            ...entry,
            categoryId: category.id,
            categoryName: category.name,
          }
        : entry
    );
    const nextPayload: AiFinanceDraftPayload = {
      ...input.payload,
      entries: nextEntries,
    };

    return {
      workspaceId: input.workspaceId ?? null,
      receiptMode: input.receiptMode ?? input.payload.receiptMode ?? null,
      payload: nextPayload,
      missingFields: [],
      currentQuestion: null,
      kind: input.payload.extraction.kind,
      confidence: input.payload.extraction.confidence,
    };
  }

  async applyConversationAction(input: {
    payload: AiFinanceDraftPayload;
    workspaceId?: string | null;
    action: AiFinanceConversationAction;
    fallbackText: string;
    receiptMode?: ReceiptMode | null;
    timezone: string;
  }) {
    const entries = input.payload.entries ?? [];
    const accounts = input.workspaceId ? await this.getWorkspaceAccounts(input.workspaceId) : [];
    const categories = input.workspaceId ? await this.getWorkspaceCategories(input.workspaceId) : [];
    const targetIndex = this.resolveTargetEntryIndex(entries, input.action, input.fallbackText);

    if (targetIndex < 0 && input.action.dateText && entries.length > 1) {
      const date = parseDateText(input.action.dateText, input.timezone, false);
      if (!date) {
        return this.toResolvedDraft(input.payload, input.workspaceId, input.receiptMode);
      }

      return this.toResolvedDraft(
        {
          ...input.payload,
          entries: entries.map((entry) => ({ ...entry, date })),
        },
        input.workspaceId,
        input.receiptMode
      );
    }

    if (targetIndex < 0 || !entries[targetIndex]) {
      return this.toResolvedDraft(input.payload, input.workspaceId, input.receiptMode);
    }

    const targetEntry = entries[targetIndex];
    const category = input.action.categoryName
      ? categories.find(
          (candidate) =>
            candidate.type === targetEntry.type && isExactCatalogName(candidate.name, input.action.categoryName)
        )
      : null;
    const account = input.action.accountName
      ? accounts.find((candidate) => isExactCatalogName(candidate.name, input.action.accountName))
      : null;
    const date = input.action.dateText ? parseDateText(input.action.dateText, input.timezone, false) : null;

    const nextEntries = entries.map((entry, index) => {
      if (index !== targetIndex) return entry;

      return {
        ...entry,
        accountId: account?.id ?? entry.accountId,
        accountName: account?.name ?? entry.accountName,
        categoryId: category?.id ?? entry.categoryId,
        categoryName: category?.name ?? entry.categoryName,
        amount: isMoney(input.action.amount) ? input.action.amount : entry.amount,
        currency: account?.currency ?? entry.currency,
        description: input.action.description ?? entry.description,
        date: date ?? entry.date,
      };
    });

    return this.toResolvedDraft(
      {
        ...input.payload,
        accountName: account?.name ?? input.payload.accountName,
        accountCurrency: account?.currency ?? input.payload.accountCurrency,
        entries: nextEntries,
      },
      input.workspaceId,
      input.receiptMode
    );
  }

  async resolveWithWorkspace(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    payload: AiFinanceDraftPayload;
    sourceType: AiFinanceSourceType;
    sourceText?: string | null;
    workspaceId: string;
    receiptMode?: ReceiptMode | null;
  }) {
    const preference = await this.preferences.setActiveWorkspace(
      input.user.id,
      input.workspaceId,
      input.telegramChatId
    );
    return this.resolveFromParts({
      user: input.user,
      telegramChatId: input.telegramChatId,
      sourceType: input.sourceType,
      sourceText: input.sourceText ?? undefined,
      extraction: input.payload.extraction,
      preference,
      receiptMode: input.receiptMode ?? input.payload.receiptMode ?? normalizeReceiptMode(preference.receiptMode),
      forcedWorkspaceId: input.workspaceId,
    });
  }

  async resolveWithAccount(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    payload: AiFinanceDraftPayload;
    sourceType: AiFinanceSourceType;
    sourceText?: string | null;
    workspaceId: string;
    accountId: string;
    receiptMode?: ReceiptMode | null;
  }) {
    const preference = await this.preferences.setDefaultAccount(
      input.user.id,
      input.workspaceId,
      input.accountId,
      input.telegramChatId
    );
    const extraction = { ...input.payload.extraction };
    if (extraction.kind === "payment" || extraction.kind === "receipt") {
      const account = await this.prisma.account.findFirst({
        where: { id: input.accountId, workspaceId: input.workspaceId, archived: false },
        select: { name: true },
      });
      extraction.accountHint = account?.name ?? extraction.accountHint;
    } else if (extraction.kind === "payments") {
      const account = await this.prisma.account.findFirst({
        where: { id: input.accountId, workspaceId: input.workspaceId, archived: false },
        select: { name: true },
      });
      extraction.payments = extraction.payments.map((payment) => ({
        ...payment,
        accountHint: account?.name ?? payment.accountHint,
      }));
    }

    return this.resolveFromParts({
      user: input.user,
      telegramChatId: input.telegramChatId,
      sourceType: input.sourceType,
      sourceText: input.sourceText ?? undefined,
      extraction,
      preference,
      receiptMode: input.receiptMode ?? input.payload.receiptMode ?? normalizeReceiptMode(preference.receiptMode),
      forcedWorkspaceId: input.workspaceId,
      forcedAccountId: input.accountId,
    });
  }

  async resolveWithReceiptMode(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    payload: AiFinanceDraftPayload;
    sourceType: AiFinanceSourceType;
    sourceText?: string | null;
    receiptMode: ReceiptMode;
    workspaceId?: string | null;
  }) {
    const preference = await this.preferences.setReceiptMode(input.user.id, input.receiptMode, input.telegramChatId);
    return this.resolveFromParts({
      user: input.user,
      telegramChatId: input.telegramChatId,
      sourceType: input.sourceType,
      sourceText: input.sourceText ?? undefined,
      extraction: input.payload.extraction,
      preference,
      receiptMode: input.receiptMode,
      forcedWorkspaceId: input.workspaceId ?? undefined,
    });
  }

  private async resolveFromParts(input: {
    user: AuthenticatedUser;
    telegramChatId?: string;
    sourceType: AiFinanceSourceType;
    sourceText?: string;
    extraction: AiFinanceExtraction;
    preference: TelegramBotPreference;
    receiptMode?: ReceiptMode | null;
    forcedWorkspaceId?: string | null;
    forcedAccountId?: string | null;
  }) {
    const workspaces = await this.getAccessibleWorkspaces(input.user.id);
    const workspace = this.resolveWorkspace(workspaces, input.preference, input.forcedWorkspaceId);
    const accounts = workspace ? await this.getWorkspaceAccounts(workspace.id) : [];
    const account = workspace
      ? this.resolveAccount(accounts, input.extraction, input.preference, workspace.id, input.forcedAccountId)
      : null;
    const toAccount =
      workspace && input.extraction.kind === "transfer"
        ? this.resolveTransferToAccount(accounts, input.extraction.toAccountHint, account?.id)
        : null;
    const categories = workspace ? await this.getWorkspaceCategories(workspace.id) : [];
    const date = this.resolveDate(input.extraction, input.preference.timezone, input.sourceType === "text");
    const receiptMode = input.extraction.kind === "receipt" ? input.receiptMode || RECEIPT_MODE_CATEGORY : null;
    const entries = this.buildEntries(
      input.extraction,
      account,
      accounts,
      input.preference,
      workspace?.id ?? null,
      categories,
      date,
      receiptMode,
      input.preference.timezone,
      input.sourceType === "text",
      input.forcedAccountId
    );
    const transfer = this.buildTransfer(input.extraction, account, toAccount, date);

    const missingFields: string[] = [];
    if (!workspace) missingFields.push("workspace");
    if (!account && (input.extraction.kind === "payment" || input.extraction.kind === "receipt"))
      missingFields.push("account");
    if (input.extraction.kind === "payments" && entries.some((entry) => !entry.accountId))
      missingFields.push("account");
    if (input.extraction.kind === "transfer" && (!account || !toAccount)) missingFields.push("account");
    if (
      input.extraction.kind !== "unknown" &&
      (input.extraction.kind === "payments" ? entries.some((entry) => !entry.date) : !date)
    )
      missingFields.push("date");
    if (!entries.length && input.extraction.kind !== "unknown" && input.extraction.kind !== "transfer")
      missingFields.push("preview");
    if (input.extraction.kind === "transfer" && !transfer) missingFields.push("preview");
    if (input.extraction.kind === "unknown") missingFields.push("preview");

    const payload: AiFinanceDraftPayload = {
      extraction: input.extraction,
      workspaceName: workspace?.name ?? null,
      accountName: account?.name ?? null,
      accountCurrency: account?.currency ?? null,
      receiptMode,
      entries,
      transfer,
    };

    return {
      workspaceId: workspace?.id ?? null,
      receiptMode,
      payload,
      missingFields,
      currentQuestion: getFirstQuestion(missingFields),
      kind: input.extraction.kind,
      confidence: input.extraction.confidence,
    };
  }

  private async getAccessibleWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private resolveWorkspace(
    workspaces: Workspace[],
    preference: TelegramBotPreference,
    forcedWorkspaceId?: string | null
  ) {
    if (forcedWorkspaceId) {
      return workspaces.find((workspace) => workspace.id === forcedWorkspaceId) ?? null;
    }

    if (preference.activeWorkspaceId) {
      const active = workspaces.find((workspace) => workspace.id === preference.activeWorkspaceId);
      if (active) return active;
    }

    return workspaces.length === 1 ? workspaces[0] : null;
  }

  private async getWorkspaceAccounts(workspaceId: string) {
    return this.prisma.account.findMany({
      where: { workspaceId, archived: false },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  private resolveAccount(
    accounts: Account[],
    extraction: AiFinanceExtraction,
    preference: TelegramBotPreference,
    workspaceId: string,
    forcedAccountId?: string | null
  ) {
    if (forcedAccountId) {
      return accounts.find((account) => account.id === forcedAccountId) ?? null;
    }

    const hint =
      extraction.kind === "payment" || extraction.kind === "receipt"
        ? normalizeHint(extraction.accountHint)
        : extraction.kind === "transfer"
          ? normalizeHint(extraction.fromAccountHint)
          : null;
    const hinted = accounts.find((account) => includesHint(account.name, hint));
    if (hinted) return hinted;

    const defaultAccountId = this.preferences.getDefaultAccountId(preference, workspaceId);
    const defaultAccount = accounts.find((account) => account.id === defaultAccountId);
    if (defaultAccount) return defaultAccount;

    return accounts.length === 1 ? accounts[0] : null;
  }

  private resolveTransferToAccount(
    accounts: Account[],
    toAccountHint: string | null | undefined,
    fromAccountId?: string
  ) {
    const hint = normalizeHint(toAccountHint);
    const hinted = accounts.find((account) => account.id !== fromAccountId && includesHint(account.name, hint));
    if (hinted) return hinted;

    const candidates = accounts.filter((account) => account.id !== fromAccountId);
    return candidates.length === 1 ? candidates[0] : null;
  }

  private async getWorkspaceCategories(workspaceId: string) {
    return this.prisma.category.findMany({
      where: { workspaceId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  private resolveDate(extraction: AiFinanceExtraction, timezone: string, allowTodayDefault: boolean) {
    if (
      extraction.kind === "payment" ||
      extraction.kind === "payments" ||
      extraction.kind === "receipt" ||
      extraction.kind === "transfer"
    ) {
      return parseDateText(extraction.dateText, timezone, allowTodayDefault);
    }

    return null;
  }

  private resolvePaymentAccount(
    accounts: Account[],
    accountHint: string | null | undefined,
    preference: TelegramBotPreference,
    workspaceId: string | null,
    fallbackAccount: Account | null,
    forcedAccountId?: string | null
  ) {
    if (forcedAccountId) {
      return accounts.find((account) => account.id === forcedAccountId) ?? null;
    }

    const hint = normalizeHint(accountHint);
    const hinted = accounts.find((account) => includesHint(account.name, hint));
    if (hinted) return hinted;

    if (fallbackAccount) return fallbackAccount;

    if (workspaceId) {
      const defaultAccountId = this.preferences.getDefaultAccountId(preference, workspaceId);
      const defaultAccount = accounts.find((account) => account.id === defaultAccountId);
      if (defaultAccount) return defaultAccount;
    }

    return accounts.length === 1 ? accounts[0] : null;
  }

  private buildEntries(
    extraction: AiFinanceExtraction,
    account: Account | null,
    accounts: Account[],
    preference: TelegramBotPreference,
    workspaceId: string | null,
    categories: Category[],
    date: string | null,
    receiptMode: ReceiptMode | null | undefined,
    timezone: string,
    allowTodayDefault: boolean,
    forcedAccountId?: string | null
  ): AiFinancePaymentEntry[] {
    if (extraction.kind === "payment") {
      if (!isMoney(extraction.amount)) return [];
      const category = this.resolveCategory(categories, extraction.categoryHint, extraction.paymentType);
      return [
        {
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          amount: extraction.amount,
          currency: account?.currency ?? extraction.currency,
          type: extraction.paymentType,
          description: extraction.description || extraction.merchant,
          date,
        },
      ];
    }

    if (extraction.kind === "payments") {
      return extraction.payments
        .filter((payment) => isMoney(payment.amount))
        .map((payment) => {
          const paymentAccount = this.resolvePaymentAccount(
            accounts,
            payment.accountHint,
            preference,
            workspaceId,
            account,
            forcedAccountId
          );
          const paymentDate = parseDateText(payment.dateText || extraction.dateText, timezone, allowTodayDefault);
          const category = this.resolveCategory(categories, payment.categoryHint, payment.paymentType);

          return {
            accountId: paymentAccount?.id ?? null,
            accountName: paymentAccount?.name ?? null,
            categoryId: category?.id ?? null,
            categoryName: category?.name ?? null,
            amount: payment.amount as string,
            currency: paymentAccount?.currency ?? payment.currency,
            type: payment.paymentType,
            description: payment.description || payment.merchant,
            date: paymentDate,
          };
        });
    }

    if (extraction.kind !== "receipt") {
      return [];
    }

    if (receiptMode === RECEIPT_MODE_SINGLE) {
      if (!isMoney(extraction.totalAmount)) return [];
      return [
        {
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          categoryId: null,
          categoryName: null,
          amount: extraction.totalAmount,
          currency: account?.currency ?? extraction.currency,
          type: "expense",
          description: extraction.merchant || "Receipt",
          date,
        },
      ];
    }

    const itemEntries = extraction.items
      .filter((item) => isMoney(item.amount))
      .map((item) => {
        const category = this.resolveCategory(categories, item.categoryHint, "expense");
        return {
          accountId: account?.id ?? null,
          accountName: account?.name ?? null,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          amount: item.amount as string,
          currency: account?.currency ?? extraction.currency,
          type: "expense" as const,
          description: item.name,
          date,
        };
      });

    if (receiptMode === RECEIPT_MODE_ITEMS) {
      return itemEntries;
    }

    const grouped = new Map<string, AiFinancePaymentEntry>();
    for (const entry of itemEntries) {
      const key = entry.categoryId ?? `description:${entry.categoryName ?? "Без категории"}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          ...entry,
          description: entry.categoryName ?? extraction.merchant ?? "Receipt",
        });
        continue;
      }

      current.amount = addMoney(current.amount, entry.amount);
    }

    return [...grouped.values()];
  }

  private buildTransfer(
    extraction: AiFinanceExtraction,
    fromAccount: Account | null,
    toAccount: Account | null,
    date: string | null
  ): AiFinanceTransferEntry | null {
    if (extraction.kind !== "transfer" || !isMoney(extraction.amount)) {
      return null;
    }

    return {
      fromAccountId: fromAccount?.id ?? null,
      fromAccountName: fromAccount?.name ?? null,
      toAccountId: toAccount?.id ?? null,
      toAccountName: toAccount?.name ?? null,
      amount: extraction.amount,
      toAmount: isMoney(extraction.toAmount) ? extraction.toAmount : extraction.amount,
      description: extraction.description,
      date,
    };
  }

  private findDraftEntryIndex(entries: AiFinancePaymentEntry[], answer: string) {
    const answerWords = new Set(getEditWords(answer));
    let bestIndex = -1;
    let bestScore = 0;

    entries.forEach((entry, index) => {
      const entryWords = getEditWords([entry.description, entry.categoryName].filter(Boolean).join(" "));
      const score = entryWords.filter((word) => answerWords.has(word)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestScore > 0 ? bestIndex : -1;
  }

  private resolveTargetEntryIndex(
    entries: AiFinancePaymentEntry[],
    action: Pick<AiFinanceConversationAction, "entryIndex" | "targetText">,
    fallbackText: string
  ) {
    if (action.entryIndex && action.entryIndex >= 1 && action.entryIndex <= entries.length) {
      return action.entryIndex - 1;
    }

    const text = action.targetText || fallbackText;
    const matchedIndex = this.findDraftEntryIndex(entries, text);
    if (matchedIndex >= 0) return matchedIndex;

    return entries.length === 1 ? 0 : -1;
  }

  private toResolvedDraft(
    payload: AiFinanceDraftPayload,
    workspaceId: string | null | undefined,
    receiptMode: ReceiptMode | null | undefined
  ) {
    return {
      workspaceId: workspaceId ?? null,
      receiptMode: receiptMode ?? payload.receiptMode ?? null,
      payload,
      missingFields: [],
      currentQuestion: null,
      kind: payload.extraction.kind,
      confidence: payload.extraction.confidence,
    };
  }

  private resolveCategory(categories: Category[], hint: string | null | undefined, type: "expense" | "income") {
    const normalizedHint = normalizeHint(hint);
    return categories.find((category) => category.type === type && includesHint(category.name, normalizedHint)) ?? null;
  }
}
