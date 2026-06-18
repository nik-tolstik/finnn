import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type Account, type Category, Currency, type TelegramBotPreference, type Workspace } from "@prisma/client";
import Big from "big.js";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { addMoney } from "@/common/money";
import { ExchangeRateService } from "@/currency/exchange-rate.service";
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
const ISO_LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const SHORT_LOCAL_DATE_PATTERN = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/;
const CURRENCY_HINT_WORD_PATTERN =
  /(?:\$|€|₽|\busd\b|\beur\b|\brub\b|\bbyn\b|\bbr\b|\bbyr\b|доллар[а-яё]*|бакс[а-яё]*|евро|российск[а-яё]*|руб[а-яё]*|белорусск[а-яё]*|беларуск[а-яё]*)/giu;

function normalizeHint(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeAccountAnswer(value: string) {
  return value
    .trim()
    .replace(/^(?:выбираю|выбери|выбрал|выбрала|это|сч[её]т|карта|карту)\s+/iu, "")
    .trim();
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

function includesCurrencyHint(account: Account, hint: string | null) {
  const currency = normalizeCurrencyCode(hint);
  return Boolean(currency && account.currency === currency);
}

function stripCurrencyHint(hint: string | null) {
  return hint?.replace(CURRENCY_HINT_WORD_PATTERN, " ").replace(/\s+/g, " ").trim() || null;
}

function resolveHintedAccount(accounts: Account[], hint: string | null, excludedAccountId?: string | null) {
  if (!hint) return null;

  const candidates = accounts.filter((account) => account.id !== excludedAccountId);
  const currency = normalizeCurrencyCode(hint);
  if (currency) {
    const currencyCandidates = candidates.filter((account) => account.currency === currency);
    const exactCurrencyMatch = currencyCandidates.find((account) => includesHint(account.name, hint));
    if (exactCurrencyMatch) return exactCurrencyMatch;

    const nameHint = stripCurrencyHint(hint);
    const namedCurrencyMatch = currencyCandidates.find((account) => includesHint(account.name, nameHint));
    if (namedCurrencyMatch) return namedCurrencyMatch;

    const currencyMatch = candidates.find((account) => includesCurrencyHint(account, hint));
    if (currencyMatch) return currencyMatch;
  }

  return candidates.find((account) => includesHint(account.name, hint)) ?? null;
}

function isExactCatalogName(name: string, value: string | null | undefined) {
  return Boolean(value && name.trim().toLowerCase() === value.trim().toLowerCase());
}

function isMoney(value: string | null | undefined): value is string {
  return Boolean(value && MONEY_PATTERN.test(value));
}

function isSameMoney(left: string | null | undefined, right: string | null | undefined) {
  if (!isMoney(left) || !isMoney(right)) return false;

  try {
    return new Big(left).eq(right);
  } catch {
    return false;
  }
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

function getZonedDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
    millisecond: date.getUTCMilliseconds(),
  };
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  const parts = getZonedDateParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime() + parts.millisecond;
}

function localDateTimeToUtc(
  parts: Pick<ReturnType<typeof getZonedDateParts>, "year" | "month" | "day" | "hour" | "minute" | "second"> & {
    millisecond?: number;
  },
  timezone: string
) {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond ?? 0)
  );
  const offset = getTimeZoneOffsetMs(utcGuess, timezone);
  const resolved = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(resolved, timezone);

  return correctedOffset === offset ? resolved : new Date(utcGuess.getTime() - correctedOffset);
}

function currentTimeOnLocalDate(
  dateParts: Pick<ReturnType<typeof getZonedDateParts>, "year" | "month" | "day">,
  timezone: string
) {
  const currentParts = getZonedDateParts(new Date(), timezone);
  return localDateTimeToUtc(
    {
      ...dateParts,
      hour: currentParts.hour,
      minute: currentParts.minute,
      second: currentParts.second,
      millisecond: currentParts.millisecond,
    },
    timezone
  );
}

function relativeLocalDate(daysOffset: number, timezone: string) {
  const currentParts = getZonedDateParts(new Date(), timezone);
  const shiftedDate = new Date(Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day + daysOffset));
  return localDateTimeToUtc(
    {
      year: shiftedDate.getUTCFullYear(),
      month: shiftedDate.getUTCMonth() + 1,
      day: shiftedDate.getUTCDate(),
      hour: currentParts.hour,
      minute: currentParts.minute,
      second: currentParts.second,
      millisecond: currentParts.millisecond,
    },
    timezone
  );
}

function parseLocalDateText(text: string, timezone: string) {
  const isoMatch = text.match(ISO_LOCAL_DATE_TIME_PATTERN);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second] = isoMatch;
    if (!year || !month || !day) return null;
    if (hour && minute) {
      return localDateTimeToUtc(
        {
          year: Number(year),
          month: Number(month),
          day: Number(day),
          hour: Number(hour),
          minute: Number(minute),
          second: Number(second ?? 0),
        },
        timezone
      );
    }

    return currentTimeOnLocalDate({ year: Number(year), month: Number(month), day: Number(day) }, timezone);
  }

  const shortMatch = text.match(SHORT_LOCAL_DATE_PATTERN);
  if (shortMatch) {
    const [, day, month, year] = shortMatch;
    if (!day || !month) return null;
    const currentParts = getZonedDateParts(new Date(), timezone);
    const fullYear = year ? Number(year.length === 2 ? `20${year}` : year) : currentParts.year;
    return currentTimeOnLocalDate({ year: fullYear, month: Number(month), day: Number(day) }, timezone);
  }

  return null;
}

function parseDateText(
  dateText: string | null | undefined,
  timezone: string,
  allowTodayDefault: boolean
): string | null {
  const text = dateText?.trim().toLowerCase();

  if (!text) {
    return allowTodayDefault ? new Date().toISOString() : null;
  }

  if (text === "today" || text === "сегодня") {
    return new Date().toISOString();
  }

  if (text === "yesterday" || text === "вчера") {
    return relativeLocalDate(-1, timezone).toISOString();
  }

  const daysAgoMatch = text.match(/(\d+)\s+(?:days?\s+ago|дн(?:я|ей|ь)?\s+назад)/);
  if (daysAgoMatch) {
    return relativeLocalDate(-Number(daysAgoMatch[1]), timezone).toISOString();
  }

  const localDate = parseLocalDateText(text, timezone);
  if (localDate) return localDate.toISOString();

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

function normalizeCurrencyCode(value: string | null | undefined): Currency | null {
  const normalizedValue = value?.trim().toUpperCase();
  if (!normalizedValue) return null;

  if (
    normalizedValue === "$" ||
    /\bUSD\b/.test(normalizedValue) ||
    normalizedValue.includes("DOLLAR") ||
    normalizedValue.includes("ДОЛЛАР")
  ) {
    return Currency.USD;
  }

  if (
    normalizedValue === "€" ||
    /\bEUR\b/.test(normalizedValue) ||
    normalizedValue.includes("EURO") ||
    normalizedValue.includes("ЕВРО")
  ) {
    return Currency.EUR;
  }

  if (normalizedValue === "₽" || /\bRUB\b/.test(normalizedValue) || normalizedValue.includes("РОС")) {
    return Currency.RUB;
  }

  if (
    normalizedValue === "BR" ||
    /\bBYN\b/.test(normalizedValue) ||
    /\bBYR\b/.test(normalizedValue) ||
    normalizedValue.includes("БЕЛ") ||
    normalizedValue.includes("РУБ")
  ) {
    return Currency.BYN;
  }

  return Object.values(Currency).includes(normalizedValue as Currency) ? (normalizedValue as Currency) : null;
}

function roundConvertedMoney(amount: string, rate: number) {
  return new Big(amount).times(rate).round(2).toFixed(2);
}

@Injectable()
export class AiFinanceResolverService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiFinancePreferenceService) private readonly preferences: AiFinancePreferenceService,
    @Inject(ExchangeRateService) private readonly exchangeRates: ExchangeRateService
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
      const accountHint = normalizeAccountAnswer(answer);
      if (extraction.kind === "payment" || extraction.kind === "receipt") {
        extraction.accountHint = accountHint;
      } else if (extraction.kind === "payments") {
        extraction.payments = extraction.payments.map((payment) => ({ ...payment, accountHint }));
      } else if (extraction.kind === "transfer") {
        extraction.fromAccountHint = accountHint;
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

    if (input.action.action === "delete_entry") {
      return this.toResolvedDraft(
        {
          ...input.payload,
          entries: entries.filter((_, index) => index !== targetIndex),
        },
        input.workspaceId,
        input.receiptMode
      );
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

      const nextAmount = isMoney(input.action.amount) ? input.action.amount : null;
      const amountChanged = Boolean(nextAmount);

      return {
        ...entry,
        accountId: account?.id ?? entry.accountId,
        accountName: account?.name ?? entry.accountName,
        categoryId: category?.id ?? entry.categoryId,
        categoryName: category?.name ?? entry.categoryName,
        amount: nextAmount ?? entry.amount,
        currency: account?.currency ?? entry.currency,
        originalAmount: amountChanged ? null : entry.originalAmount,
        originalCurrency: amountChanged ? null : entry.originalCurrency,
        exchangeRate: amountChanged ? null : entry.exchangeRate,
        description: input.action.description ?? entry.description,
        date: date ?? entry.date,
      };
    });
    const convertedEntries = await this.convertEntries(nextEntries, accounts);

    return this.toResolvedDraft(
      {
        ...input.payload,
        accountName: account?.name ?? input.payload.accountName,
        accountCurrency: account?.currency ?? input.payload.accountCurrency,
        entries: convertedEntries,
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
    const entries = await this.convertEntries(
      this.buildEntries(
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
      ),
      accounts
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
    const hinted = resolveHintedAccount(accounts, hint);
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
    const hinted = resolveHintedAccount(accounts, hint, fromAccountId);
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

  private getAccountCurrency(accounts: Account[], entry: AiFinancePaymentEntry) {
    const account = entry.accountId ? accounts.find((candidate) => candidate.id === entry.accountId) : null;
    return normalizeCurrencyCode(account?.currency ?? entry.currency);
  }

  private async convertEntries(entries: AiFinancePaymentEntry[], accounts: Account[]) {
    return Promise.all(
      entries.map(async (entry) => {
        const sourceCurrency = normalizeCurrencyCode(entry.originalCurrency ?? entry.currency);
        const targetCurrency = this.getAccountCurrency(accounts, entry);
        const sourceAmount = entry.originalAmount ?? entry.amount;

        if (!sourceCurrency && entry.currency) {
          throw new BadRequestException(`Валюта ${entry.currency} пока не поддерживается`);
        }

        if (sourceCurrency && targetCurrency && sourceCurrency === targetCurrency) {
          return {
            ...entry,
            amount: sourceAmount,
            currency: targetCurrency,
            originalAmount: null,
            originalCurrency: null,
            exchangeRate: null,
          };
        }

        if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency || !entry.date) {
          return {
            ...entry,
            currency: (targetCurrency ?? sourceCurrency)?.toString() ?? entry.currency,
          };
        }

        const rate = await this.exchangeRates.getExchangeRate(new Date(entry.date), sourceCurrency, targetCurrency);

        return {
          ...entry,
          amount: roundConvertedMoney(sourceAmount, rate),
          currency: targetCurrency,
          originalAmount: sourceAmount,
          originalCurrency: sourceCurrency,
          exchangeRate: String(rate),
        };
      })
    );
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
    const hinted = resolveHintedAccount(accounts, hint);
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
          currency: extraction.currency ?? account?.currency ?? null,
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
            currency: payment.currency ?? paymentAccount?.currency ?? null,
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
          currency: extraction.currency ?? account?.currency ?? null,
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
          currency: extraction.currency ?? account?.currency ?? null,
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
      fromAccountCurrency: fromAccount?.currency ?? null,
      toAccountId: toAccount?.id ?? null,
      toAccountName: toAccount?.name ?? null,
      toAccountCurrency: toAccount?.currency ?? null,
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
    action: Pick<AiFinanceConversationAction, "entryIndex" | "targetText" | "amount">,
    fallbackText: string
  ) {
    if (action.entryIndex && action.entryIndex >= 1 && action.entryIndex <= entries.length) {
      return action.entryIndex - 1;
    }

    if (action.amount) {
      const amountMatches = entries
        .map((entry, index) => (isSameMoney(entry.amount, action.amount) ? index : -1))
        .filter((index) => index >= 0);
      if (amountMatches.length === 1) return amountMatches[0];

      const originalAmountMatches = entries
        .map((entry, index) => (isSameMoney(entry.originalAmount, action.amount) ? index : -1))
        .filter((index) => index >= 0);
      if (originalAmountMatches.length === 1) return originalAmountMatches[0];
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
