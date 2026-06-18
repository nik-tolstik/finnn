import { HttpException, Inject, Injectable } from "@nestjs/common";
import type { AiFinanceDraft } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
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
  /(?:какие|список|покажи|доступн|есть).*(?:счет|счёт|счета|счёта)|(?:счет|счёт|счета|счёта).*(?:доступн|есть)|^(?:счета|счёта)$/iu;
const IMAGE_DATE_REFERENCE_PATTERN = /(?:скрин|скриншот|фото|картин|изображен|чек|там).*(?:дат|врем)/iu;
const EXPLICIT_DATE_ANSWER_PATTERN =
  /(?:сегодня|вчера|today|yesterday|\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,4})?|\d+\s+(?:days?\s+ago|дн(?:я|ей|ь)?\s+назад))/iu;

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

function isImageDateReferenceAnswer(answer: string) {
  return IMAGE_DATE_REFERENCE_PATTERN.test(answer) && !EXPLICIT_DATE_ANSWER_PATTERN.test(answer);
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
    const wantsCategories = CATEGORY_CATALOG_PATTERN.test(normalizedText);
    const wantsAccounts = ACCOUNT_CATALOG_PATTERN.test(normalizedText);
    if (!wantsCategories && !wantsAccounts) return null;

    const context = await this.getPromptContext(user.id, telegramChatId);
    if (!context) {
      return "Не вижу активный рабочий стол. Сначала выберите workspace в Finnn или отправьте операцию, и я попрошу выбрать workspace.";
    }

    if (wantsAccounts && !wantsCategories) {
      return [
        `Workspace: ${context.workspaceName}`,
        formatList(
          "Счета",
          context.accounts.map((account) => `${account.name} (${account.currency})`)
        ),
      ].join("\n\n");
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

  async createDraftFromExtraction(
    user: AuthenticatedUser,
    sourceType: AiFinanceSourceType,
    extraction: AiFinanceExtraction,
    telegramChatId?: string,
    sourceText?: string
  ) {
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
      const action = await this.parser.parseConversationAction(answer, context);
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

    if (input.action.action === "update_entry") {
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
    const preference = await this.preferences.getOrCreatePreference(userId, telegramChatId);
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "desc" },
    });
    const workspace = preference.activeWorkspaceId
      ? workspaces.find((candidate) => candidate.id === preference.activeWorkspaceId)
      : workspaces.length === 1
        ? workspaces[0]
        : null;

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
