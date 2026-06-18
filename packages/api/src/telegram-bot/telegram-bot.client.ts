import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { TelegramFile, TelegramInlineKeyboardMarkup, TelegramMessage } from "./telegram-update.types";

type TelegramApiResponse = {
  ok?: boolean;
  result?: unknown;
  description?: string;
};

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new ServiceUnavailableException("Telegram bot token is not configured");
  }

  return token;
}

function getTelegramApiUrl(method: string) {
  return `https://api.telegram.org/bot${getTelegramBotToken()}/${method}`;
}

function getDataUrlMimeType(filePath: string, blobType: string) {
  const normalizedBlobType = blobType.trim().toLowerCase();
  if (normalizedBlobType && normalizedBlobType !== "application/octet-stream") {
    return normalizedBlobType;
  }

  const extension = filePath.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

async function readTelegramJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  const json = (text ? JSON.parse(text) : {}) as TelegramApiResponse;
  if (!response.ok || json?.ok === false) {
    const description = json.description ? `: ${json.description}` : "";
    throw new BadRequestException(`Telegram Bot API request failed${description}`);
  }

  return json.result as T;
}

@Injectable()
export class TelegramBotClient {
  async sendMessage(input: { chatId: string; text: string; replyMarkup?: TelegramInlineKeyboardMarkup }) {
    const response = await fetch(getTelegramApiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        reply_markup: input.replyMarkup,
      }),
    });

    return readTelegramJson<TelegramMessage>(response);
  }

  async deleteMessage(input: { chatId: string; messageId: number }) {
    const response = await fetch(getTelegramApiUrl("deleteMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        message_id: input.messageId,
      }),
    });

    return readTelegramJson<boolean>(response);
  }

  async editMessageText(input: {
    chatId: string;
    messageId: number;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
  }) {
    const response = await fetch(getTelegramApiUrl("editMessageText"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        message_id: input.messageId,
        text: input.text,
        reply_markup: input.replyMarkup,
      }),
    });

    return readTelegramJson(response);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const response = await fetch(getTelegramApiUrl("answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });

    return readTelegramJson(response);
  }

  async getFile(fileId: string): Promise<TelegramFile> {
    const response = await fetch(getTelegramApiUrl("getFile"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });

    return readTelegramJson(response);
  }

  async downloadFile(filePath: string): Promise<Blob> {
    const response = await fetch(`https://api.telegram.org/file/bot${getTelegramBotToken()}/${filePath}`);
    if (!response.ok) {
      throw new BadRequestException("Telegram file download failed");
    }

    return response.blob();
  }

  async downloadFileAsDataUrl(fileId: string) {
    const file = await this.getFile(fileId);
    if (!file.file_path) {
      throw new BadRequestException("Telegram file path is missing");
    }

    const blob = await this.downloadFile(file.file_path);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mimeType = getDataUrlMimeType(file.file_path, blob.type);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }
}
