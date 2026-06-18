import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import type { AiFinanceExtraction } from "./ai-finance.types";
import { OpenRouterClient } from "./openrouter.client";

export type AiFinancePromptContext = {
  workspaceName: string;
  accounts: Array<{ name: string; currency: string }>;
  categories: Array<{ name: string; type: "expense" | "income" }>;
  currentDraftSummary?: string | null;
};

export type AiFinanceConversationAction = {
  action: "create_draft" | "update_entry" | "set_receipt_mode" | "commit" | "cancel" | "ask_clarification";
  targetText: string | null;
  entryIndex: number | null;
  categoryName: string | null;
  accountName: string | null;
  dateText: string | null;
  amount: string | null;
  description: string | null;
  receiptMode: "single" | "category" | "items" | null;
  question: string | null;
  createText: string | null;
  confidence: number;
};

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { enum: ["payment", "payments", "receipt", "transfer", "unknown"] },
    paymentType: { enum: ["expense", "income", null] },
    amount: { type: ["string", "null"] },
    toAmount: { type: ["string", "null"] },
    totalAmount: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    merchant: { type: ["string", "null"] },
    dateText: { type: ["string", "null"] },
    accountHint: { type: ["string", "null"] },
    fromAccountHint: { type: ["string", "null"] },
    toAccountHint: { type: ["string", "null"] },
    categoryHint: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    payments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          paymentType: { enum: ["expense", "income"] },
          amount: { type: ["string", "null"] },
          currency: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          merchant: { type: ["string", "null"] },
          dateText: { type: ["string", "null"] },
          accountHint: { type: ["string", "null"] },
          categoryHint: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "paymentType",
          "amount",
          "currency",
          "description",
          "merchant",
          "dateText",
          "accountHint",
          "categoryHint",
          "confidence",
        ],
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: ["string", "null"] },
          categoryHint: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["name", "amount", "categoryHint", "confidence"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "kind",
    "paymentType",
    "amount",
    "toAmount",
    "totalAmount",
    "currency",
    "description",
    "merchant",
    "dateText",
    "accountHint",
    "fromAccountHint",
    "toAccountHint",
    "categoryHint",
    "reason",
    "payments",
    "items",
    "confidence",
  ],
};

const CONVERSATION_ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      enum: ["create_draft", "update_entry", "set_receipt_mode", "commit", "cancel", "ask_clarification"],
    },
    targetText: { type: ["string", "null"] },
    entryIndex: { type: ["number", "null"], minimum: 1 },
    categoryName: { type: ["string", "null"] },
    accountName: { type: ["string", "null"] },
    dateText: { type: ["string", "null"] },
    amount: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    receiptMode: { enum: ["single", "category", "items", null] },
    question: { type: ["string", "null"] },
    createText: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "action",
    "targetText",
    "entryIndex",
    "categoryName",
    "accountName",
    "dateText",
    "amount",
    "description",
    "receiptMode",
    "question",
    "createText",
    "confidence",
  ],
};

const TEXT_AMOUNT_PATTERN =
  /(?:^|\s)(?:за|на|по)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:byn|br|бел(?:орусских)?\.?\s*руб(?:лей|ля|ль)?|руб(?:лей|ля|ль)?|р\.?)(?:\s|$)/iu;
const EXTRACTION_AMOUNT_PATTERN = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

const CATEGORY_KEYWORDS = [
  { words: ["блин", "мама дома", "кофе", "кафе", "еда", "обед", "ужин", "завтрак"], names: ["питание", "еда", "кафе"] },
  { words: ["заправ", "бензин", "топливо", "машин", "авто"], names: ["машина", "авто", "транспорт"] },
  { words: ["ноутбук", "подар"], names: ["подарки", "техника", "покупки"] },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isMoney(value: string | null | undefined): value is string {
  return Boolean(value && EXTRACTION_AMOUNT_PATTERN.test(value));
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAmount(value: string) {
  return value.replace(",", ".");
}

function getFallbackCurrency(context?: AiFinancePromptContext | null) {
  return (
    context?.accounts.find((account) => account.currency === "BYN")?.currency ?? context?.accounts[0]?.currency ?? "BYN"
  );
}

function getFallbackCategoryHint(text: string, context?: AiFinancePromptContext | null) {
  const normalizedText = normalizeText(text);
  const categories = context?.categories.filter((category) => category.type === "expense") ?? [];

  for (const rule of CATEGORY_KEYWORDS) {
    if (!rule.words.some((word) => normalizedText.includes(word))) continue;

    const category = categories.find((candidate) => {
      const categoryName = normalizeText(candidate.name);
      return rule.names.some((name) => categoryName === name || categoryName.includes(name));
    });
    if (category) return category.name;
  }

  return null;
}

function getFallbackDescription(line: string) {
  return line
    .replace(TEXT_AMOUNT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(купил|купила|заправил|заправила)\s+/iu, "")
    .trim();
}

function parseSimplePaymentLines(text: string, context?: AiFinancePromptContext | null): AiFinanceExtraction | null {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const payments = lines.flatMap((line) => {
    const match = line.match(TEXT_AMOUNT_PATTERN);
    if (!match?.[1]) return [];

    return [
      {
        paymentType: "expense" as const,
        amount: normalizeAmount(match[1]),
        currency: getFallbackCurrency(context),
        description: getFallbackDescription(line) || line,
        merchant: null,
        dateText: null,
        accountHint: null,
        categoryHint: getFallbackCategoryHint(line, context),
        confidence: 0.65,
      },
    ];
  });

  if (!payments.length) return null;

  if (payments.length === 1) {
    const [payment] = payments;
    return {
      kind: "payment",
      paymentType: payment.paymentType,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      merchant: payment.merchant,
      dateText: payment.dateText,
      accountHint: payment.accountHint,
      categoryHint: payment.categoryHint,
      confidence: payment.confidence,
    };
  }

  return {
    kind: "payments",
    dateText: null,
    payments,
    confidence: 0.65,
  };
}

function isUsableTextExtraction(extraction: AiFinanceExtraction) {
  if (extraction.kind === "payment") return isMoney(extraction.amount);
  if (extraction.kind === "payments") return extraction.payments.some((payment) => isMoney(payment.amount));
  if (extraction.kind === "transfer") return isMoney(extraction.amount);
  if (extraction.kind === "receipt")
    return isMoney(extraction.totalAmount) || extraction.items.some((item) => isMoney(item.amount));
  return false;
}

function assertValidPayment(value: Record<string, unknown>, message: string) {
  if (
    (value.paymentType !== "expense" && value.paymentType !== "income") ||
    !isNullableString(value.amount) ||
    !isNullableString(value.currency) ||
    !isNullableString(value.description) ||
    !isNullableString(value.merchant) ||
    !isNullableString(value.dateText) ||
    !isNullableString(value.accountHint) ||
    !isNullableString(value.categoryHint) ||
    !isConfidence(value.confidence)
  ) {
    throw new BadRequestException(message);
  }
}

function assertValidExtraction(value: unknown): AiFinanceExtraction {
  if (!isObject(value) || typeof value.kind !== "string" || !isConfidence(value.confidence)) {
    throw new BadRequestException("AI finance extraction is invalid");
  }

  if (value.kind === "payment") {
    assertValidPayment(value, "AI payment extraction is invalid");

    return value as AiFinanceExtraction;
  }

  if (value.kind === "payments") {
    if (!isNullableString(value.dateText) || !Array.isArray(value.payments) || value.payments.length === 0) {
      throw new BadRequestException("AI payments extraction is invalid");
    }

    for (const payment of value.payments) {
      if (!isObject(payment)) {
        throw new BadRequestException("AI payments extraction is invalid");
      }

      assertValidPayment(payment, "AI payment item extraction is invalid");
    }

    return value as AiFinanceExtraction;
  }

  if (value.kind === "receipt") {
    if (
      !isNullableString(value.merchant) ||
      !isNullableString(value.totalAmount) ||
      !isNullableString(value.currency) ||
      !isNullableString(value.dateText) ||
      !isNullableString(value.accountHint) ||
      !Array.isArray(value.items)
    ) {
      throw new BadRequestException("AI receipt extraction is invalid");
    }

    for (const item of value.items) {
      if (
        !isObject(item) ||
        typeof item.name !== "string" ||
        !isNullableString(item.amount) ||
        !isNullableString(item.categoryHint) ||
        !isConfidence(item.confidence)
      ) {
        throw new BadRequestException("AI receipt item extraction is invalid");
      }
    }

    return value as AiFinanceExtraction;
  }

  if (value.kind === "transfer") {
    if (
      !isNullableString(value.amount) ||
      !isNullableString(value.toAmount) ||
      !isNullableString(value.fromAccountHint) ||
      !isNullableString(value.toAccountHint) ||
      !isNullableString(value.dateText) ||
      !isNullableString(value.description)
    ) {
      throw new BadRequestException("AI transfer extraction is invalid");
    }

    return value as AiFinanceExtraction;
  }

  if (value.kind === "unknown" && typeof value.reason === "string") {
    return value as AiFinanceExtraction;
  }

  throw new BadRequestException("AI finance extraction is invalid");
}

function isConversationAction(value: unknown): value is AiFinanceConversationAction {
  if (!isObject(value) || typeof value.action !== "string" || !isConfidence(value.confidence)) {
    return false;
  }

  if (
    value.action !== "create_draft" &&
    value.action !== "update_entry" &&
    value.action !== "set_receipt_mode" &&
    value.action !== "commit" &&
    value.action !== "cancel" &&
    value.action !== "ask_clarification"
  ) {
    return false;
  }

  return (
    isNullableString(value.targetText) &&
    (value.entryIndex === null || (typeof value.entryIndex === "number" && Number.isFinite(value.entryIndex))) &&
    isNullableString(value.categoryName) &&
    isNullableString(value.accountName) &&
    isNullableString(value.dateText) &&
    isNullableString(value.amount) &&
    isNullableString(value.description) &&
    (value.receiptMode === null ||
      value.receiptMode === "single" ||
      value.receiptMode === "category" ||
      value.receiptMode === "items") &&
    isNullableString(value.question) &&
    isNullableString(value.createText)
  );
}

function assertValidConversationAction(value: unknown): AiFinanceConversationAction {
  if (!isConversationAction(value)) {
    throw new BadRequestException("AI finance conversation action is invalid");
  }

  return value;
}

function buildContextPrompt(context?: AiFinancePromptContext | null) {
  if (!context) {
    return [
      "No workspace catalog is available yet.",
      "Use categoryHint/accountHint only when the user explicitly names them; otherwise use null.",
    ].join("\n");
  }

  const accounts = context.accounts.length
    ? context.accounts.map((account) => `- ${account.name} (${account.currency})`).join("\n")
    : "- none";
  const categories = context.categories.length
    ? context.categories.map((category) => `- ${category.name} (${category.type})`).join("\n")
    : "- none";

  return [
    `Workspace: ${context.workspaceName}`,
    "Accounts available to choose from:",
    accounts,
    "Categories available to choose from:",
    categories,
    "For accountHint, use the exact account name from the list when relevant; otherwise use null.",
    "For categoryHint, use the exact category name from the list with the matching payment type; otherwise use null.",
    "Never invent category names or account names.",
    context.currentDraftSummary ? `Current draft:\n${context.currentDraftSummary}` : "Current draft: none.",
  ].join("\n");
}

@Injectable()
export class AiFinanceParserService {
  constructor(@Inject(OpenRouterClient) private readonly openRouter: OpenRouterClient) {}

  async parseText(text: string, context?: AiFinancePromptContext | null): Promise<AiFinanceExtraction> {
    const content = await this.openRouter.createStructuredCompletion(
      [
        {
          role: "system",
          content:
            "Extract Finnn finance intents from the user's message. If the message contains multiple independent payments, use kind=payments and include each payment separately. Return strict JSON only. Money amounts must stay strings. Always include every schema field; use null or [] for fields that do not apply to the selected kind.",
        },
        {
          role: "system",
          content: buildContextPrompt(context),
        },
        { role: "user", content: text },
      ],
      EXTRACTION_SCHEMA
    );

    try {
      const extraction = assertValidExtraction(JSON.parse(content));
      return isUsableTextExtraction(extraction) ? extraction : (parseSimplePaymentLines(text, context) ?? extraction);
    } catch (error) {
      const fallbackExtraction = parseSimplePaymentLines(text, context);
      if (fallbackExtraction) return fallbackExtraction;
      throw error;
    }
  }

  async parseConversationAction(
    text: string,
    context?: AiFinancePromptContext | null
  ): Promise<AiFinanceConversationAction> {
    const content = await this.openRouter.createStructuredCompletion(
      [
        {
          role: "system",
          content: [
            "You are a Finnn finance draft assistant.",
            "Classify the user's message as one action against the current draft.",
            "Use update_entry for edits like changing category, account, amount, date, or description.",
            "Use commit only when the user clearly confirms the current draft.",
            "Use cancel only when the user clearly cancels.",
            "Use set_receipt_mode for requests to split/group receipts.",
            "Use create_draft only when the user explicitly asks to start a new operation.",
            "Use ask_clarification if the edit cannot be mapped to the current draft.",
            "For categoryName and accountName, use exact names from the provided lists only; otherwise null.",
            "entryIndex is 1-based when the user targets a numbered draft row; otherwise null.",
          ].join("\n"),
        },
        {
          role: "system",
          content: buildContextPrompt(context),
        },
        { role: "user", content: text },
      ],
      CONVERSATION_ACTION_SCHEMA
    );

    return assertValidConversationAction(JSON.parse(content));
  }

  async parseReceiptImage(
    dataUrl: string,
    context?: AiFinancePromptContext | null,
    userNote?: string | null
  ): Promise<AiFinanceExtraction> {
    const content = await this.openRouter.extractReceiptFromImage(
      dataUrl,
      [
        "Extract receipt items, total, currency, merchant, date, account hint, and likely category hints.",
        "If the image is a bank or finance app transaction-history screenshot, use kind=payments and extract each visible transaction as a separate payment.",
        "For visible transaction dates/times, set dateText on each payment. Prefer ISO-like dates such as YYYY-MM-DD or YYYY-MM-DD HH:mm when the image shows enough information.",
        userNote ? `User note/caption: ${userNote}` : null,
        "Return strict JSON only. Always include every schema field; use null or [] for fields that do not apply to the selected kind.",
        buildContextPrompt(context),
      ]
        .filter(Boolean)
        .join("\n"),
      EXTRACTION_SCHEMA
    );

    return assertValidExtraction(JSON.parse(content));
  }
}
