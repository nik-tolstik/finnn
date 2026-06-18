import { HttpException, Inject, Injectable } from "@nestjs/common";
import type { AiFinanceDraft } from "@prisma/client";
import Big from "big.js";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { formatMoney } from "@/common/money";
import { PrismaService } from "@/prisma/prisma.service";

import {
  AI_DRAFT_READY,
  type AiFinanceDraftPayload,
  type AiFinanceExtraction,
  type AiFinanceQuestion,
  type AiFinanceSourceType,
  type ReceiptMode,
} from "./ai-finance.types";
import { AiFinanceCommitService } from "./ai-finance-commit.service";
import { AiFinanceDraftService } from "./ai-finance-draft.service";
import {
  type AiFinanceConversationAction,
  AiFinanceParserService,
  type AiFinancePromptContext,
} from "./ai-finance-parser.service";
import { AiFinancePreferenceService } from "./ai-finance-preference.service";
import { AiFinancePreviewService } from "./ai-finance-preview.service";
import { AiFinanceResolverService } from "./ai-finance-resolver.service";

const CONFIRMATION_TEXTS = new Set(["отлично", "ок", "ok", "создай", "подтверждаю", "да", "всё верно", "все верно"]);
const CANCELLATION_TEXTS = new Set(["отмена", "cancel", "не надо", "отмени", "стоп"]);
const NEW_DRAFT_PREFIXES = ["новая операция:", "новая транзакция:", "добавь новое:"];
const CATEGORY_CATALOG_PATTERN =
  /(?:какие|список|покажи|доступн|есть).*(?:категор|категории)|(?:категор|категории).*(?:доступн|есть)|^категории$/iu;
const ACCOUNT_CATALOG_PATTERN =
  /(?:какие|список|покажи|доступн|есть).*(?:сч[её]т\w*|карт\w*)|(?:сч[её]т\w*|карт\w*).*(?:доступн|есть)|^(?:сч[её]т\w*|карт\w*)$/iu;
const ACCOUNT_BALANCE_QUESTION_PATTERN =
  /(?:баланс|остат|сколько|деньг).*(?:сч[её]т\w*|карт\w*)|(?:сч[её]т\w*|карт\w*).*(?:баланс|остат|сколько|деньг)/iu;
const OPEN_DEBTS_QUESTION_PATTERN =
  /(?:какие|список|покажи|есть|открыт\w*).*(?:долг\w*)|(?:долг\w*).*(?:открыт\w*|есть|список|покажи|какие)|(?:кому\s+я\s+долж|кто\s+мне\s+долж)/iu;
const TODAY_SPENDING_QUESTION_PATTERN =
  /(?:сколько|какая сумма|итого|сумм[ау]).*(?:сегодня).*(?:потрат|расход|списан)|(?:потрат|расход|списан).*(?:сегодня).*(?:сколько|какая сумма|итого|сумм[ау])/iu;
const IMAGE_DATE_REFERENCE_PATTERN = /(?:скрин|скриншот|фото|картин|изображен|чек|там).*(?:дат|врем)/iu;
const EXPLICIT_DATE_ANSWER_PATTERN =
  /(?:сегодня|вчера|today|yesterday|\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,4})?|\d+\s+(?:days?\s+ago|дн(?:я|ей|ь)?\s+назад))/iu;
const DELETE_ENTRY_PATTERN = /(?:убери|убрать|удали|удалить|исключи|исключить|убрал|убрала|без|remove|delete|drop)/iu;
const DELETE_ENTRY_AMOUNT_PATTERN =
  /(\d+(?:[.,]\d{1,2})?)\s*(?:byn|br|бел(?:орусских)?\.?\s*руб(?:лей|ля|ль)?|руб(?:лей|ля|ль)?|р\.?)/iu;
const DELETE_ENTRY_INDEX_PATTERNS: Array<[RegExp, number]> = [
  [/(?:перв(?:ую|ая|ой)?|first|(?:номер|строк[ауи]?|операци[яюи]|транзакци[яюи]|#|№)\s*1)/iu, 1],
  [/(?:втор(?:ую|ая|ой)?|second|(?:номер|строк[ауи]?|операци[яюи]|транзакци[яюи]|#|№)\s*2)/iu, 2],
  [/(?:треть(?:ю|я|ей)?|third|(?:номер|строк[ауи]?|операци[яюи]|транзакци[яюи]|#|№)\s*3)/iu, 3],
  [/(?:четверт(?:ую|ая|ой)?|fourth|(?:номер|строк[ауи]?|операци[яюи]|транзакци[яюи]|#|№)\s*4)/iu, 4],
  [/(?:пят(?:ую|ая|ой)?|fifth|(?:номер|строк[ауи]?|операци[яюи]|транзакци[яюи]|#|№)\s*5)/iu, 5],
];

function normalizeCommandText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getNewDraftText(value: string) {
  const normalized = normalizeCommandText(value);
  const prefix = NEW_DRAFT_PREFIXES.find((candidate) => normalized.startsWith(candidate));
  if (!prefix) return null;

  return value.slice(prefix.length).trim() || null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "string") return response;
    if (response && typeof response === "object" && "message" in response) {
      const message = response.message;
      return Array.isArray(message) ? message.join("\n") : String(message);
    }
  }

  return error instanceof Error ? error.message : "Unknown error";
}

function formatList(title: string, items: string[]) {
  return items.length ? [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n") : `${title}: нет`;
}

function getUnknownFinanceIntentMessage() {
  return "Я не понял, какую операцию создать. Напишите расход, доход или перевод с суммой.";
}

function formatDebtType(type: string) {
  if (type === "lent") return "мне должны";
  if (type === "borrowed") return "я должен";
  return type;
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
  parts: Pick<ReturnType<typeof getZonedDateParts>, "year" | "month" | "day" | "hour" | "minute" | "second">,
  timezone: string
) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const offset = getTimeZoneOffsetMs(utcGuess, timezone);
  const resolved = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(resolved, timezone);

  return correctedOffset === offset ? resolved : new Date(utcGuess.getTime() - correctedOffset);
}

function getTodayRange(timezone: string) {
  const nowParts = getZonedDateParts(new Date(), timezone);
  const start = localDateTimeToUtc({ ...nowParts, hour: 0, minute: 0, second: 0 }, timezone);
  const nextDay = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + 1));
  const end = localDateTimeToUtc(
    {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );

  return { start, end };
}

function isImageDateReferenceAnswer(answer: string) {
  return IMAGE_DATE_REFERENCE_PATTERN.test(answer) && !EXPLICIT_DATE_ANSWER_PATTERN.test(answer);
}

function parseLocalDeleteAction(answer: string): AiFinanceConversationAction | null {
  if (!DELETE_ENTRY_PATTERN.test(answer)) return null;

  const amount = answer.match(DELETE_ENTRY_AMOUNT_PATTERN)?.[1]?.replace(",", ".") ?? null;
  const entryIndex = DELETE_ENTRY_INDEX_PATTERNS.find(([pattern]) => pattern.test(answer))?.[1] ?? null;
  if (!amount && !entryIndex) return null;

  return {
    action: "delete_entry",
    targetText: answer,
    entryIndex,
    categoryName: null,
    accountName: null,
    dateText: null,
    amount,
    description: null,
    receiptMode: null,
    question: null,
    createText: null,
    confidence: 0.9,
  };
}

@Injectable()
export class AiFinanceService {
  constructor(
    @Inject(AiFinanceParserService) private readonly parser: AiFinanceParserService,
    @Inject(AiFinanceResolverService) private readonly resolver: AiFinanceResolverService,
    @Inject(AiFinanceDraftService) private readonly drafts: AiFinanceDraftService,
    @Inject(AiFinancePreviewService) private readonly preview: AiFinancePreviewService,
    @Inject(AiFinanceCommitService) private readonly commit: AiFinanceCommitService,
    @Inject(AiFinancePreferenceService) private readonly preferences: AiFinancePreferenceService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async createDraftFromText(user: AuthenticatedUser, text: string, telegramChatId?: string) {
    const context = await this.getPromptContext(user.id, telegramChatId);
    const extraction = await this.parser.parseText(text, context);
    return this.createDraftFromExtraction(user, "text", extraction, telegramChatId, text);
  }

  async createDraftFromReceiptImage(
    user: AuthenticatedUser,
    dataUrl: string,
    telegramChatId?: string,
    sourceText?: string | null
  ) {
    const context = await this.getPromptContext(user.id, telegramChatId);
    const extraction = await this.parser.parseReceiptImage(dataUrl, context, sourceText);
    return this.createDraftFromExtraction(user, "receipt", extraction, telegramChatId, sourceText ?? undefined);
  }

  async answerCatalogQuestion(user: AuthenticatedUser, text: string, telegramChatId?: string) {
    const normalizedText = normalizeCommandText(text);
    if (TODAY_SPENDING_QUESTION_PATTERN.test(normalizedText)) {
      return this.answerTodaySpendingQuestion(user, telegramChatId);
    }

    if (OPEN_DEBTS_QUESTION_PATTERN.test(normalizedText)) {
      return this.answerOpenDebtsQuestion(user, telegramChatId);
    }

    const wantsCategories = CATEGORY_CATALOG_PATTERN.test(normalizedText);
    const wantsAccounts =
      ACCOUNT_CATALOG_PATTERN.test(normalizedText) || ACCOUNT_BALANCE_QUESTION_PATTERN.test(normalizedText);
    if (!wantsCategories && !wantsAccounts) return null;

    const workspace = await this.getActiveWorkspace(user.id, telegramChatId);
    if (!workspace) {
      return "Не вижу активный рабочий стол. Сначала выберите workspace в Finnn или отправьте операцию, и я попрошу выбрать workspace.";
    }

    if (wantsAccounts && !wantsCategories) {
      const accounts = await this.prisma.account.findMany({
        where: { workspaceId: workspace.id, archived: false },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: { name: true, balance: true, currency: true },
      });

      return [`Workspace: ${workspace.name}`, formatList("Счета", this.formatAccounts(accounts))].join("\n\n");
    }

    const context = await this.getPromptContext(user.id, telegramChatId);
    if (!context) {
      return "Не вижу активный рабочий стол. Сначала выберите workspace в Finnn или отправьте операцию, и я попрошу выбрать workspace.";
    }

    const expenseCategories = context.categories
      .filter((category) => category.type === "expense")
      .map((category) => category.name);
    const incomeCategories = context.categories
      .filter((category) => category.type === "income")
      .map((category) => category.name);

    return [
      `Workspace: ${context.workspaceName}`,
      formatList("Категории расходов", expenseCategories),
      formatList("Категории доходов", incomeCategories),
    ].join("\n\n");
  }

  private async answerTodaySpendingQuestion(user: AuthenticatedUser, telegramChatId?: string) {
    const preference = await this.preferences.getOrCreatePreference(user.id, telegramChatId);
    const workspace = await this.getActiveWorkspace(user.id, telegramChatId);

    if (!workspace) {
      return "Не вижу активный workspace. Откройте Finnn или выберите рабочий стол, потом спросите ещё раз.";
    }

    const { start, end } = getTodayRange(preference.timezone);
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: {
        workspaceId: workspace.id,
        type: "expense",
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        account: {
          select: {
            currency: true,
          },
        },
      },
    });
    const totalsByCurrency = new Map<string, Big>();
    for (const transaction of transactions) {
      const currency = transaction.account.currency;
      const current = totalsByCurrency.get(currency) ?? new Big(0);
      totalsByCurrency.set(currency, current.plus(transaction.amount));
    }

    if (!totalsByCurrency.size) {
      return `Сегодня в ${workspace.name} расходов пока нет.`;
    }

    const totals = [...totalsByCurrency.entries()]
      .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
      .map(([currency, amount]) => formatMoney(amount.toString(), currency))
      .join(", ");

    return `Сегодня в ${workspace.name} потрачено: ${totals}.`;
  }

  private async answerOpenDebtsQuestion(user: AuthenticatedUser, telegramChatId?: string) {
    const workspace = await this.getActiveWorkspace(user.id, telegramChatId);

    if (!workspace) {
      return "Не вижу активный workspace. Откройте Finnn или выберите рабочий стол, потом спросите ещё раз.";
    }

    const debts = await this.prisma.debt.findMany({
      where: { workspaceId: workspace.id, status: "open" },
      orderBy: [{ date: "desc" }],
      select: {
        personName: true,
        type: true,
        remainingAmount: true,
        currency: true,
      },
    });

    if (!debts.length) {
      return `В ${workspace.name} открытых долгов нет.`;
    }

    return [
      `Workspace: ${workspace.name}`,
      formatList(
        "Открытые долги",
        debts.map(
          (debt) =>
            `${debt.personName}: ${formatMoney(debt.remainingAmount, debt.currency)} (${formatDebtType(debt.type)})`
        )
      ),
    ].join("\n\n");
  }

  async createDraftFromExtraction(
    user: AuthenticatedUser,
    sourceType: AiFinanceSourceType,
    extraction: AiFinanceExtraction,
    telegramChatId?: string,
    sourceText?: string
  ) {
    if (extraction.kind === "unknown") {
      throw new HttpException(getUnknownFinanceIntentMessage(), 400);
    }

    const resolved = await this.resolver.resolveInitial({
      user,
      telegramChatId,
      sourceType,
      sourceText,
      extraction,
    });
    const draft = await this.drafts.createDraft({
      userId: user.id,
      telegramChatId,
      workspaceId: resolved.workspaceId,
      sourceType,
      sourceText,
      receiptMode: resolved.receiptMode,
      kind: resolved.kind,
      payload: resolved.payload,
      missingFields: resolved.missingFields,
      confidence: resolved.confidence,
      currentQuestion: resolved.currentQuestion,
    });

    return this.toDraftResponse(draft.id, draft.status, draft.currentQuestion, resolved.payload);
  }

  async answerDraft(user: AuthenticatedUser, draftId: string, answer: string, telegramChatId?: string) {
    const draft = await this.drafts.getActiveDraftOrThrow(draftId, user.id);
    const payload = this.drafts.parsePayload(draft);
    const normalizedAnswer = normalizeCommandText(answer);
    const newDraftText = getNewDraftText(answer);

    if (newDraftText) {
      await this.drafts.cancelActiveDraft(user.id, telegramChatId);
      return this.createDraftFromText(user, newDraftText, telegramChatId);
    }

    if (CANCELLATION_TEXTS.has(normalizedAnswer)) {
      await this.drafts.cancelActiveDraft(user.id, telegramChatId);
      return {
        draftId,
        status: "cancelled",
        currentQuestion: null,
        text: "Черновик отменён.",
        payload,
      };
    }

    if (!draft.currentQuestion && draft.status === AI_DRAFT_READY && CONFIRMATION_TEXTS.has(normalizedAnswer)) {
      return this.commitActiveDraftFromChat(user, draftId, payload);
    }

    if (!draft.currentQuestion && draft.status === AI_DRAFT_READY) {
      const context = await this.getPromptContext(user.id, telegramChatId, payload);
      const action = parseLocalDeleteAction(answer) ?? (await this.parser.parseConversationAction(answer, context));
      return this.applyConversationAction({ user, draftId, draft, payload, action, answer, telegramChatId });
    }

    if (draft.currentQuestion === "date" && draft.sourceType === "receipt" && isImageDateReferenceAnswer(answer)) {
      return {
        draftId,
        status: draft.status,
        currentQuestion: draft.currentQuestion,
        text: "Я не смог прочитать дату со скриншота. Напишите дату текстом, например `сегодня`, `вчера` или `2026-06-18`.",
        payload,
      };
    }

    const resolved = await this.resolver.applyAnswer({
      user,
      telegramChatId,
      payload,
      sourceType: draft.sourceType as AiFinanceSourceType,
      sourceText: draft.sourceText,
      currentQuestion: draft.currentQuestion,
      answer,
      receiptMode: draft.receiptMode as ReceiptMode | null,
      workspaceId: draft.workspaceId,
    });

    return this.updateDraftFromResolved(user.id, draft.id, resolved);
  }

  async setWorkspace(user: AuthenticatedUser, draftId: string, workspaceId: string, telegramChatId?: string) {
    const draft = await this.drafts.getActiveDraftOrThrow(draftId, user.id);
    const payload = this.drafts.parsePayload(draft);
    const resolved = await this.resolver.resolveWithWorkspace({
      user,
      telegramChatId,
      payload,
      sourceType: draft.sourceType as AiFinanceSourceType,
      sourceText: draft.sourceText,
      workspaceId,
      receiptMode: draft.receiptMode as ReceiptMode | null,
    });

    return this.updateDraftFromResolved(user.id, draft.id, resolved);
  }

  async setAccount(user: AuthenticatedUser, draftId: string, accountId: string, telegramChatId?: string) {
    const draft = await this.drafts.getActiveDraftOrThrow(draftId, user.id);
    const payload = this.drafts.parsePayload(draft);
    if (!draft.workspaceId) {
      return this.toDraftResponse(draft.id, draft.status, draft.currentQuestion, payload);
    }

    const resolved = await this.resolver.resolveWithAccount({
      user,
      telegramChatId,
      payload,
      sourceType: draft.sourceType as AiFinanceSourceType,
      sourceText: draft.sourceText,
      workspaceId: draft.workspaceId,
      accountId,
      receiptMode: draft.receiptMode as ReceiptMode | null,
    });

    return this.updateDraftFromResolved(user.id, draft.id, resolved);
  }

  async setReceiptMode(user: AuthenticatedUser, draftId: string, receiptMode: ReceiptMode, telegramChatId?: string) {
    const draft = await this.drafts.getActiveDraftOrThrow(draftId, user.id);
    const payload = this.drafts.parsePayload(draft);
    const resolved = await this.resolver.resolveWithReceiptMode({
      user,
      telegramChatId,
      payload,
      sourceType: draft.sourceType as AiFinanceSourceType,
      sourceText: draft.sourceText,
      receiptMode,
      workspaceId: draft.workspaceId,
    });

    return this.updateDraftFromResolved(user.id, draft.id, resolved);
  }

  async cancelActiveDraft(user: AuthenticatedUser, telegramChatId?: string) {
    return this.drafts.cancelActiveDraft(user.id, telegramChatId);
  }

  async commitDraft(user: AuthenticatedUser, draftId: string) {
    return this.commit.commitDraft(draftId, user);
  }

  private async applyConversationAction(input: {
    user: AuthenticatedUser;
    draftId: string;
    draft: AiFinanceDraft;
    payload: ReturnType<AiFinanceDraftService["parsePayload"]>;
    action: AiFinanceConversationAction;
    answer: string;
    telegramChatId?: string;
  }) {
    if (input.action.action === "cancel") {
      await this.drafts.cancelActiveDraft(input.user.id, input.telegramChatId);
      return {
        draftId: input.draftId,
        status: "cancelled",
        currentQuestion: null,
        text: "Черновик отменён.",
        payload: input.payload,
      };
    }

    if (input.action.action === "commit") {
      return this.commitActiveDraftFromChat(input.user, input.draftId, input.payload);
    }

    if (input.action.action === "create_draft") {
      await this.drafts.cancelActiveDraft(input.user.id, input.telegramChatId);
      return this.createDraftFromText(input.user, input.action.createText || input.answer, input.telegramChatId);
    }

    if (input.action.action === "ask_clarification") {
      return {
        draftId: input.draftId,
        status: input.draft.status,
        currentQuestion: null,
        text: input.action.question || "Уточните, пожалуйста, что изменить в черновике.",
        payload: input.payload,
      };
    }

    if (input.action.action === "set_receipt_mode" && input.action.receiptMode) {
      const resolved = await this.resolver.resolveWithReceiptMode({
        user: input.user,
        telegramChatId: input.telegramChatId,
        payload: input.payload,
        sourceType: input.draft.sourceType as AiFinanceSourceType,
        sourceText: input.draft.sourceText,
        receiptMode: input.action.receiptMode,
        workspaceId: input.draft.workspaceId,
      });

      return this.updateDraftFromResolved(input.user.id, input.draft.id, resolved);
    }

    if (input.action.action === "update_entry" || input.action.action === "delete_entry") {
      const preference = await this.preferences.getOrCreatePreference(input.user.id, input.telegramChatId);
      const resolved = await this.resolver.applyConversationAction({
        payload: input.payload,
        workspaceId: input.draft.workspaceId,
        action: input.action,
        fallbackText: input.answer,
        receiptMode: input.draft.receiptMode as ReceiptMode | null,
        timezone: preference.timezone,
      });

      return this.updateDraftFromResolved(input.user.id, input.draft.id, resolved);
    }

    return {
      draftId: input.draftId,
      status: input.draft.status,
      currentQuestion: null,
      text: "Не понял, что изменить. Напишите, например: `ноутбук в подарки` или `отлично`.",
      payload: input.payload,
    };
  }

  private async commitActiveDraftFromChat(
    user: AuthenticatedUser,
    draftId: string,
    payload: ReturnType<AiFinanceDraftService["parsePayload"]>
  ) {
    try {
      const result = await this.commitDraft(user, draftId);
      return {
        draftId,
        status: "committed",
        currentQuestion: null,
        text: result.createdTransferTransactionId
          ? "Готово. Перевод создан."
          : `Готово. Создано записей: ${result.createdPaymentTransactionIds.length}.`,
        payload,
      };
    } catch (error) {
      return {
        draftId,
        status: "failed",
        currentQuestion: null,
        text: `Не получилось создать операцию: ${getErrorMessage(error)}`,
        payload: {
          ...payload,
          error: getErrorMessage(error),
        },
      };
    }
  }

  private async updateDraftFromResolved(
    userId: string,
    draftId: string,
    resolved: {
      workspaceId: string | null;
      receiptMode: ReceiptMode | null;
      payload: AiFinanceDraftPayload;
      missingFields: string[];
      currentQuestion: AiFinanceQuestion | null;
    }
  ) {
    const updated = await this.drafts.updateDraft(draftId, userId, {
      workspaceId: resolved.workspaceId,
      receiptMode: resolved.receiptMode,
      payload: resolved.payload,
      missingFields: resolved.missingFields,
      currentQuestion: resolved.currentQuestion,
    });

    return this.toDraftResponse(updated.id, updated.status, updated.currentQuestion, resolved.payload);
  }

  private async getPromptContext(
    userId: string,
    telegramChatId?: string,
    payload?: ReturnType<AiFinanceDraftService["parsePayload"]>
  ): Promise<AiFinancePromptContext | null> {
    const workspace = await this.getActiveWorkspace(userId, telegramChatId);

    if (!workspace) {
      return null;
    }

    const [accounts, categories] = await Promise.all([
      this.prisma.account.findMany({
        where: { workspaceId: workspace.id, archived: false },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: { name: true, currency: true },
      }),
      this.prisma.category.findMany({
        where: { workspaceId: workspace.id },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { name: true, type: true },
      }),
    ]);

    return {
      workspaceName: workspace.name,
      accounts,
      categories: categories.filter(
        (category): category is { name: string; type: "expense" | "income" } =>
          category.type === "expense" || category.type === "income"
      ),
      currentDraftSummary: payload
        ? this.preview.renderDraft({ draftId: "active", status: AI_DRAFT_READY, payload })
        : null,
    };
  }

  private async getActiveWorkspace(userId: string, telegramChatId?: string) {
    const preference = await this.preferences.getOrCreatePreference(userId, telegramChatId);
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return preference.activeWorkspaceId
      ? (workspaces.find((candidate) => candidate.id === preference.activeWorkspaceId) ?? null)
      : workspaces.length === 1
        ? workspaces[0]
        : null;
  }

  private formatAccounts(accounts: Array<{ name: string; balance: string; currency: string }>) {
    return accounts.map((account) => `${account.name}: ${formatMoney(account.balance, account.currency)}`);
  }

  private toDraftResponse(
    draftId: string,
    status: string,
    currentQuestion: string | null,
    payload: Parameters<AiFinancePreviewService["renderDraft"]>[0]["payload"]
  ) {
    return {
      draftId,
      status,
      currentQuestion,
      text: this.preview.renderDraft({ draftId, status, currentQuestion, payload }),
      payload,
    };
  }
}
