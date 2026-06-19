import { BadRequestException, HttpException, Inject, Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";

import { AiFinanceService } from "@/ai-finance/ai-finance.service";
import {
  AI_DRAFT_READY,
  RECEIPT_MODE_CATEGORY,
  RECEIPT_MODE_ITEMS,
  RECEIPT_MODE_SINGLE,
  type ReceiptMode,
} from "@/ai-finance/ai-finance.types";
import { AiFinanceDraftService } from "@/ai-finance/ai-finance-draft.service";
import { OpenRouterClient } from "@/ai-finance/openrouter.client";
import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import { TelegramBotClient } from "./telegram-bot.client";
import {
  encodeTelegramCallbackData,
  type ParsedTelegramCallbackData,
  parseTelegramCallbackData,
} from "./telegram-callback-data";
import type {
  TelegramCallbackQuery,
  TelegramInlineKeyboardMarkup,
  TelegramMessage,
  TelegramPhotoSize,
  TelegramUpdate,
  TelegramUser,
} from "./telegram-update.types";

const TELEGRAM_PROVIDER = "telegram";
const CANCELLATION_TEXTS = new Set(["отмена", "cancel", "не надо", "отмени", "стоп"]);

type ResolvedTelegramUser = {
  telegramUserId: string;
  user: AuthenticatedUser;
};

function toAuthenticatedUser(user: Pick<User, "id" | "email" | "name" | "image" | "emailVerified">): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified?.toISOString() ?? null,
  };
}

function getChatId(message: TelegramMessage) {
  return String(message.chat.id);
}

function isPrivateChat(message: TelegramMessage) {
  return message.chat.type === "private";
}

function getWebAppUrl() {
  return process.env.WEB_APP_URL?.trim() || "https://finnn.xyz";
}

function getDashboardWebAppUrl() {
  try {
    const dashboardUrl = new URL("/dashboard", getWebAppUrl());
    return dashboardUrl.protocol === "https:" ? dashboardUrl.toString() : null;
  } catch {
    return null;
  }
}

function buildOpenFinnnKeyboard(): TelegramInlineKeyboardMarkup | undefined {
  const dashboardUrl = getDashboardWebAppUrl();
  if (!dashboardUrl) return undefined;

  return {
    inline_keyboard: [[{ text: "Open Finnn", web_app: { url: dashboardUrl } }]],
  };
}

function getLargestPhoto(photos: TelegramPhotoSize[]) {
  return [...photos].sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

function getReceiptModeFromCallback(action: ParsedTelegramCallbackData["action"]): ReceiptMode | null {
  if (action === "mode-single") return RECEIPT_MODE_SINGLE;
  if (action === "mode-category") return RECEIPT_MODE_CATEGORY;
  if (action === "mode-items") return RECEIPT_MODE_ITEMS;
  return null;
}

function getExceptionMessage(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "string") return normalizeAiFinanceErrorMessage(response);
    if (response && typeof response === "object" && "message" in response) {
      const message = response.message;
      return normalizeAiFinanceErrorMessage(Array.isArray(message) ? message.join("\n") : String(message));
    }
  }

  return normalizeAiFinanceErrorMessage(error instanceof Error ? error.message : "Unknown error");
}

function normalizeAiFinanceErrorMessage(message: string) {
  if (message.includes("AI finance extraction is invalid")) {
    return "Я не понял, какую операцию создать. Напишите расход, доход или перевод с суммой.";
  }

  return message;
}

function normalizeCommandText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isCancellationText(value: string) {
  return CANCELLATION_TEXTS.has(normalizeCommandText(value));
}

function isTelegramMessageNotModifiedError(error: unknown) {
  return getExceptionMessage(error).includes("message is not modified");
}

@Injectable()
export class TelegramBotService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TelegramBotClient) private readonly telegram: TelegramBotClient,
    @Inject(AiFinanceService) private readonly aiFinance: AiFinanceService,
    @Inject(AiFinanceDraftService) private readonly drafts: AiFinanceDraftService,
    @Inject(OpenRouterClient) private readonly openRouter: OpenRouterClient
  ) {}

  async handleUpdate(update: TelegramUpdate) {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return { ok: true };
    }

    if (update.message) {
      await this.handleMessage(update.message);
      return { ok: true };
    }

    return { ok: true };
  }

  private async handleMessage(message: TelegramMessage) {
    if (!isPrivateChat(message)) {
      return;
    }

    if (!message.from) {
      return;
    }

    const chatId = getChatId(message);
    const resolvedUser = await this.resolveTelegramUser(message.from);
    if (!resolvedUser) {
      await this.sendUnknownUserMessage(chatId);
      return;
    }

    const text = message.text?.trim();
    if (text?.startsWith("/")) {
      await this.handleCommand(text, chatId, resolvedUser.user);
      return;
    }

    if (message.voice) {
      await this.handleVoiceMessage(message, resolvedUser.user);
      return;
    }

    if (message.photo?.length) {
      await this.handleReceiptPhoto(message, resolvedUser.user);
      return;
    }

    if (text) {
      await this.handleTextMessage(chatId, text, resolvedUser.user);
      return;
    }

    await this.telegram.sendMessage({ chatId, text: "Отправьте текст, голосовое сообщение или фото чека." });
  }

  private async handleCommand(commandText: string, chatId: string, user: AuthenticatedUser) {
    const command = commandText.split(/\s+/)[0];

    if (command === "/start") {
      await this.sendStartMessage(chatId, user);
      return;
    }

    if (command === "/cancel") {
      const cancelledDraft = await this.aiFinance.cancelActiveDraft(user, chatId);
      await this.telegram.sendMessage({
        chatId,
        text: cancelledDraft
          ? "Черновик отменён."
          : "Активного черновика нет. Отправьте операцию, чтобы создать новый черновик.",
      });
      return;
    }

    if (command === "/workspace") {
      const draft = await this.drafts.findActiveDraft(user.id, chatId);
      if (!draft) {
        await this.telegram.sendMessage({ chatId, text: "Сначала отправьте операцию, потом выберите рабочий стол." });
        return;
      }
      const workspacePrompt = await this.buildWorkspacePrompt(user.id, draft.id);
      await this.telegram.sendMessage({
        chatId,
        text: workspacePrompt.text,
        replyMarkup: workspacePrompt.replyMarkup,
      });
      return;
    }

    if (command === "/account") {
      const draft = await this.drafts.findActiveDraft(user.id, chatId);
      if (!draft?.workspaceId) {
        await this.telegram.sendMessage({ chatId, text: "Сначала выберите рабочий стол." });
        return;
      }
      await this.telegram.sendMessage({
        chatId,
        text: "Выберите счёт.",
        replyMarkup: await this.buildAccountKeyboard(draft.workspaceId, draft.id),
      });
      return;
    }

    await this.telegram.sendMessage({
      chatId,
      text: "Команды: /start, /cancel, /workspace, /account.",
    });
  }

  private async handleTextMessage(chatId: string, text: string, user: AuthenticatedUser) {
    const activeDraft = await this.drafts.findActiveDraft(user.id, chatId);

    if (!activeDraft && isCancellationText(text)) {
      await this.telegram.sendMessage({
        chatId,
        text: "Активного черновика нет. Отправьте операцию, чтобы создать новый черновик.",
      });
      return;
    }

    const catalogAnswer = await this.aiFinance.answerCatalogQuestion(user, text, chatId);
    if (catalogAnswer) {
      await this.telegram.sendMessage({ chatId, text: catalogAnswer });
      return;
    }

    const reply = await this.withAiErrorMessage(chatId, async () =>
      this.withThinkingMessage(chatId, async () => {
        const response = activeDraft
          ? await this.aiFinance.answerDraft(user, activeDraft.id, text, chatId)
          : await this.aiFinance.createDraftFromText(user, text, chatId);
        return this.buildDraftReply(user.id, response);
      })
    );
    if (!reply) return;

    await this.telegram.sendMessage({
      chatId,
      text: reply.text,
      replyMarkup: reply.replyMarkup,
    });
  }

  private async handleReceiptPhoto(message: TelegramMessage, user: AuthenticatedUser) {
    const chatId = getChatId(message);
    const photo = getLargestPhoto(message.photo || []);
    if (!photo) {
      throw new BadRequestException("Photo is missing");
    }
    const caption = message.caption?.trim() || null;

    const reply = await this.withAiErrorMessage(chatId, async () =>
      this.withThinkingMessage(chatId, async () => {
        const dataUrl = await this.telegram.downloadFileAsDataUrl(photo.file_id);
        const response = await this.aiFinance.createDraftFromReceiptImage(user, dataUrl, chatId, caption);
        return this.buildDraftReply(user.id, response);
      })
    );
    if (!reply) return;
    await this.telegram.sendMessage({
      chatId,
      text: reply.text,
      replyMarkup: reply.replyMarkup,
    });
  }

  private async handleVoiceMessage(message: TelegramMessage, user: AuthenticatedUser) {
    const chatId = getChatId(message);
    if (!message.voice) return;

    const result = await this.withAiErrorMessage(chatId, async () =>
      this.withThinkingMessage(chatId, async () => {
        const file = await this.telegram.getFile(message.voice?.file_id || "");
        if (!file.file_path) {
          throw new BadRequestException("Telegram voice file path is missing");
        }

        const blob = await this.telegram.downloadFile(file.file_path);
        const transcript = await this.openRouter.transcribeAudio(blob, file.file_path);
        const response = await this.aiFinance.createDraftFromText(user, transcript, chatId);
        const reply = await this.buildDraftReply(user.id, response);
        return { reply, transcript };
      })
    );
    if (!result) return;
    await this.telegram.sendMessage({
      chatId,
      text: `Распознал: ${result.transcript}\n\n${result.reply.text}`,
      replyMarkup: result.reply.replyMarkup,
    });
  }

  private async withAiErrorMessage<T>(chatId: string, action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      await this.telegram.sendMessage({
        chatId,
        text: `Не получилось разобрать сообщение: ${getExceptionMessage(error)}`,
      });
      return null;
    }
  }

  private async withThinkingMessage<T>(chatId: string, action: () => Promise<T>) {
    const thinkingMessage = await this.sendThinkingMessage(chatId);
    try {
      return await action();
    } finally {
      await this.safeDeleteMessage(chatId, thinkingMessage?.message_id);
    }
  }

  private async sendThinkingMessage(chatId: string) {
    try {
      return await this.telegram.sendMessage({ chatId, text: "Думаю..." });
    } catch {
      return null;
    }
  }

  private async safeDeleteMessage(chatId: string, messageId: number | null | undefined) {
    if (!messageId) return;

    try {
      await this.telegram.deleteMessage({ chatId, messageId });
    } catch {
      return;
    }
  }

  private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery) {
    const chatId = callbackQuery.message ? getChatId(callbackQuery.message) : null;
    const messageId = callbackQuery.message?.message_id;
    if (callbackQuery.message && !isPrivateChat(callbackQuery.message)) {
      await this.safeAnswerCallbackQuery(callbackQuery.id);
      return;
    }

    const resolvedUser = await this.resolveTelegramUser(callbackQuery.from);
    if (!resolvedUser || !chatId) {
      await this.safeAnswerCallbackQuery(callbackQuery.id, "Откройте Finnn и подключите Telegram.");
      return;
    }

    let responseText = "";
    let draftId = "";
    let status = "";
    let currentQuestion: string | null = null;

    await this.safeAnswerCallbackQuery(callbackQuery.id);

    try {
      const parsed = parseTelegramCallbackData(callbackQuery.data);
      draftId = parsed.draftId;

      if (parsed.action === "cancel") {
        await this.aiFinance.cancelActiveDraft(resolvedUser.user, chatId);
        responseText = "Черновик отменён.";
      } else if (parsed.action === "confirm") {
        const result = await this.aiFinance.commitDraft(resolvedUser.user, parsed.draftId);
        responseText = result.createdTransferTransactionId
          ? "Готово. Перевод создан."
          : `Готово. Создано записей: ${result.createdPaymentTransactionIds.length}.`;
      } else {
        const draftResponse = await this.applyCallbackSelection(parsed, resolvedUser.user, chatId);
        responseText = draftResponse.text;
        draftId = draftResponse.draftId;
        status = draftResponse.status;
        currentQuestion = draftResponse.currentQuestion;
      }

      const reply =
        status && responseText
          ? await this.buildDraftReply(resolvedUser.user.id, { draftId, status, currentQuestion, text: responseText })
          : null;

      if (messageId) {
        await this.safeEditMessageText({
          chatId,
          messageId,
          text: reply?.text ?? responseText,
          replyMarkup: reply?.replyMarkup,
        });
      } else {
        await this.telegram.sendMessage({ chatId, text: responseText });
      }
    } catch (error) {
      const errorText = `Не получилось создать операцию: ${getExceptionMessage(error)}`;
      if (messageId) {
        await this.safeEditMessageText({ chatId, messageId, text: errorText });
      } else {
        await this.telegram.sendMessage({ chatId, text: errorText });
      }
    }
  }

  private async safeEditMessageText(input: {
    chatId: string;
    messageId: number;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
  }) {
    try {
      await this.telegram.editMessageText(input);
    } catch (error) {
      if (isTelegramMessageNotModifiedError(error)) {
        return;
      }

      throw error;
    }
  }

  private async safeAnswerCallbackQuery(callbackQueryId: string, text?: string) {
    try {
      await this.telegram.answerCallbackQuery(callbackQueryId, text);
    } catch {
      return;
    }
  }

  private async applyCallbackSelection(parsed: ParsedTelegramCallbackData, user: AuthenticatedUser, chatId: string) {
    if (parsed.action === "workspace" && parsed.value) {
      return this.aiFinance.setWorkspace(user, parsed.draftId, parsed.value, chatId);
    }

    if (parsed.action === "account" && parsed.value) {
      return this.aiFinance.setAccount(user, parsed.draftId, parsed.value, chatId);
    }

    const receiptMode = getReceiptModeFromCallback(parsed.action);
    if (receiptMode) {
      return this.aiFinance.setReceiptMode(user, parsed.draftId, receiptMode, chatId);
    }

    throw new BadRequestException("Unsupported Telegram callback action");
  }

  private async sendUnknownUserMessage(chatId: string) {
    await this.telegram.sendMessage({
      chatId,
      text: "Telegram ещё не подключен к Finnn. Откройте приложение и войдите через Telegram.",
      replyMarkup: buildOpenFinnnKeyboard(),
    });
  }

  private async sendStartMessage(chatId: string, user: AuthenticatedUser) {
    const preference = await this.prisma.telegramBotPreference.findUnique({ where: { userId: user.id } });
    const workspace = preference?.activeWorkspaceId
      ? await this.prisma.workspace.findUnique({ where: { id: preference.activeWorkspaceId } })
      : null;
    await this.telegram.sendMessage({
      chatId,
      text: [
        "Finnn готов принимать расходы, доходы и чеки.",
        workspace ? `Активный рабочий стол: ${workspace.name}` : "Активный рабочий стол пока не выбран.",
        "Пример: Кофе 8 BYN вчера с карты.",
      ].join("\n"),
    });
  }

  private async resolveTelegramUser(telegramUser: TelegramUser): Promise<ResolvedTelegramUser | null> {
    const telegramUserId = String(telegramUser.id);
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId: telegramUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!identity?.user) {
      return null;
    }

    return {
      telegramUserId,
      user: toAuthenticatedUser(identity.user),
    };
  }

  private async buildDraftReply(
    userId: string,
    response: { draftId: string; status: string; currentQuestion: string | null; text: string }
  ): Promise<{ text: string; replyMarkup?: TelegramInlineKeyboardMarkup }> {
    if (response.currentQuestion === "workspace") {
      return this.buildWorkspacePrompt(userId, response.draftId);
    }

    return {
      text: response.text,
      replyMarkup: await this.buildDraftKeyboard(userId, response.draftId, response.status, response.currentQuestion),
    };
  }

  private async buildDraftKeyboard(
    userId: string,
    draftId: string,
    status: string,
    currentQuestion: string | null
  ): Promise<TelegramInlineKeyboardMarkup | undefined> {
    if (currentQuestion === "workspace") {
      return (await this.buildWorkspacePrompt(userId, draftId)).replyMarkup;
    }

    if (currentQuestion === "account") {
      const draft = await this.prisma.aiFinanceDraft.findUnique({ where: { id: draftId } });
      return draft?.workspaceId ? this.buildAccountKeyboard(draft.workspaceId, draftId) : undefined;
    }

    if (status === AI_DRAFT_READY) {
      return undefined;
    }

    return undefined;
  }

  private async buildWorkspacePrompt(
    userId: string,
    draftId: string
  ): Promise<{ text: string; replyMarkup?: TelegramInlineKeyboardMarkup }> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (workspaces.length === 0) {
      return {
        text: "Сначала создайте рабочий стол в Finnn, затем вернитесь в бот и отправьте операцию ещё раз.",
        replyMarkup: buildOpenFinnnKeyboard(),
      };
    }

    return {
      text: "Выберите рабочий стол.",
      replyMarkup: {
        inline_keyboard: workspaces.map((workspace) => [
          { text: workspace.name, callback_data: encodeTelegramCallbackData("workspace", draftId, workspace.id) },
        ]),
      },
    };
  }

  private async buildAccountKeyboard(workspaceId: string, draftId: string): Promise<TelegramInlineKeyboardMarkup> {
    const accounts = await this.prisma.account.findMany({
      where: { workspaceId, archived: false },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 20,
    });

    return {
      inline_keyboard: accounts.map((account) => [
        { text: account.name, callback_data: encodeTelegramCallbackData("account", draftId, account.id) },
      ]),
    };
  }
}
