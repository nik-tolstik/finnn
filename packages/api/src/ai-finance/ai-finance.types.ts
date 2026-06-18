import type { AuthenticatedUser } from "@/auth/auth.types";

export const AI_DRAFT_PENDING = "pending";
export const AI_DRAFT_READY = "ready";
export const AI_DRAFT_COMMITTING = "committing";
export const AI_DRAFT_COMMITTED = "committed";
export const AI_DRAFT_CANCELLED = "cancelled";
export const AI_DRAFT_EXPIRED = "expired";
export const AI_DRAFT_FAILED = "failed";

export const RECEIPT_MODE_SINGLE = "single";
export const RECEIPT_MODE_CATEGORY = "category";
export const RECEIPT_MODE_ITEMS = "items";

export type AiDraftStatus =
  | typeof AI_DRAFT_PENDING
  | typeof AI_DRAFT_READY
  | typeof AI_DRAFT_COMMITTING
  | typeof AI_DRAFT_COMMITTED
  | typeof AI_DRAFT_CANCELLED
  | typeof AI_DRAFT_EXPIRED
  | typeof AI_DRAFT_FAILED;

export type ReceiptMode = typeof RECEIPT_MODE_SINGLE | typeof RECEIPT_MODE_CATEGORY | typeof RECEIPT_MODE_ITEMS;
export type AiFinanceSourceType = "text" | "voice" | "receipt";
export type AiFinanceQuestion = "workspace" | "account" | "date" | "preview";

export type AiFinanceExtraction =
  | {
      kind: "payment";
      paymentType: "expense" | "income";
      amount: string | null;
      currency: string | null;
      description: string | null;
      merchant: string | null;
      dateText: string | null;
      accountHint: string | null;
      categoryHint: string | null;
      confidence: number;
    }
  | {
      kind: "payments";
      dateText: string | null;
      payments: Array<{
        paymentType: "expense" | "income";
        amount: string | null;
        currency: string | null;
        description: string | null;
        merchant: string | null;
        dateText: string | null;
        accountHint: string | null;
        categoryHint: string | null;
        confidence: number;
      }>;
      confidence: number;
    }
  | {
      kind: "receipt";
      merchant: string | null;
      totalAmount: string | null;
      currency: string | null;
      dateText: string | null;
      accountHint: string | null;
      items: Array<{
        name: string;
        amount: string | null;
        categoryHint: string | null;
        confidence: number;
      }>;
      confidence: number;
    }
  | {
      kind: "transfer";
      amount: string | null;
      toAmount: string | null;
      fromAccountHint: string | null;
      toAccountHint: string | null;
      dateText: string | null;
      description: string | null;
      confidence: number;
    }
  | {
      kind: "unknown";
      reason: string;
      confidence: number;
    };

export type AiFinancePaymentEntry = {
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  currency: string | null;
  originalAmount?: string | null;
  originalCurrency?: string | null;
  exchangeRate?: string | null;
  type: "expense" | "income";
  description: string | null;
  date: string | null;
};

export type AiFinanceTransferEntry = {
  fromAccountId: string | null;
  fromAccountName: string | null;
  fromAccountCurrency: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  toAccountCurrency: string | null;
  amount: string;
  toAmount: string;
  description: string | null;
  date: string | null;
};

export type AiFinanceDraftPayload = {
  extraction: AiFinanceExtraction;
  workspaceName?: string | null;
  accountName?: string | null;
  accountCurrency?: string | null;
  receiptMode?: ReceiptMode | null;
  entries?: AiFinancePaymentEntry[];
  transfer?: AiFinanceTransferEntry | null;
  createdPaymentTransactionIds?: string[];
  createdTransferTransactionId?: string | null;
  error?: string;
};

export type AiFinanceResolvedDraft = {
  user: AuthenticatedUser;
  telegramChatId?: string;
  sourceType: AiFinanceSourceType;
  sourceText?: string;
  extraction: AiFinanceExtraction;
};
