import { Injectable } from "@nestjs/common";

import {
  AI_DRAFT_READY,
  type AiFinanceDraftPayload,
  RECEIPT_MODE_CATEGORY,
  RECEIPT_MODE_ITEMS,
  RECEIPT_MODE_SINGLE,
} from "./ai-finance.types";

function getQuestionText(question: string | null | undefined) {
  if (question === "workspace") return "Выберите рабочий стол.";
  if (question === "account") return "Выберите счёт или напишите его название.";
  if (question === "date") return "Укажите дату, например: вчера, 5 days ago или 2026-06-13.";
  return "Не удалось собрать черновик. Уточните данные текстом или напишите `отмена`.";
}

function getReceiptModeLabel(mode: string | null | undefined) {
  if (mode === RECEIPT_MODE_SINGLE) return "одна транзакция";
  if (mode === RECEIPT_MODE_ITEMS) return "по позициям";
  if (mode === RECEIPT_MODE_CATEGORY) return "по категориям";
  return null;
}

function getEntryAmountText(entry: NonNullable<AiFinanceDraftPayload["entries"]>[number], fallbackCurrency: string) {
  const currency = entry.currency ?? fallbackCurrency;
  const convertedFrom =
    entry.originalAmount && entry.originalCurrency && entry.originalCurrency !== currency
      ? ` из ${entry.originalAmount} ${entry.originalCurrency}`
      : "";

  return `${entry.amount} ${currency}${convertedFrom}`.trim();
}

@Injectable()
export class AiFinancePreviewService {
  renderDraft(input: {
    draftId: string;
    status: string;
    currentQuestion?: string | null;
    payload: AiFinanceDraftPayload;
  }) {
    if (input.status !== AI_DRAFT_READY) {
      return getQuestionText(input.currentQuestion);
    }

    const lines: string[] = [];
    lines.push("Я собрал черновик:");
    lines.push(`Workspace: ${input.payload.workspaceName ?? "-"}`);
    lines.push(`Account: ${input.payload.accountName ?? "-"}`);
    if (input.payload.receiptMode) {
      lines.push(`Receipt mode: ${getReceiptModeLabel(input.payload.receiptMode)}`);
    }
    lines.push("");

    if (input.payload.entries?.length) {
      lines.push("Операции:");
      for (const entry of input.payload.entries) {
        const type = entry.type === "income" ? "Income" : "Expense";
        const account = entry.accountName ? `[${entry.accountName}] ` : "";
        const category = entry.categoryName ? `${entry.categoryName}: ` : "";
        const amount = getEntryAmountText(entry, input.payload.accountCurrency ?? "");
        const description = entry.description ? ` (${entry.description})` : "";
        lines.push(`- ${account}${type}: ${category}${amount}${description}`.trim());
      }
      const total = input.payload.entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
      lines.push("");
      lines.push(`Total: ${total.toFixed(2)} ${input.payload.accountCurrency ?? ""}`.trim());
      lines.push("");
      lines.push("Напишите `отлично`, чтобы создать. Или пришлите правку обычным текстом.");
      return lines.join("\n");
    }

    if (input.payload.transfer) {
      const transfer = input.payload.transfer;
      lines.push("Перевод:");
      lines.push(`- From: ${transfer.fromAccountName ?? "-"}`);
      lines.push(`- To: ${transfer.toAccountName ?? "-"}`);
      lines.push(`- Amount: ${transfer.amount}`);
      lines.push(`- Destination amount: ${transfer.toAmount}`);
      if (transfer.description) lines.push(`- Description: ${transfer.description}`);
      lines.push("");
      lines.push("Напишите `отлично`, чтобы создать. Или пришлите правку обычным текстом.");
      return lines.join("\n");
    }

    if (input.payload.extraction.kind === "unknown") {
      return `Не понял операцию: ${input.payload.extraction.reason}`;
    }

    return "Черновик готов, но нет записей для создания.";
  }
}
