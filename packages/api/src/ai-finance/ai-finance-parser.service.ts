import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import Big from "big.js";

import type { AiFinanceDescriptionSource, AiFinanceExtraction } from "./ai-finance.types";
import { OpenRouterClient } from "./openrouter.client";

export type AiFinancePromptContext = {
  workspaceName: string;
  accounts: Array<{ name: string; currency: string }>;
  categories: Array<{ name: string; type: "expense" | "income" }>;
  currentDraftSummary?: string | null;
};

export type AiFinanceConversationAction = {
  action:
    | "create_draft"
    | "update_entry"
    | "delete_entry"
    | "set_receipt_mode"
    | "commit"
    | "cancel"
    | "ask_clarification";
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

const DESCRIPTION_SOURCES = [
  "none",
  "explicit_user_note",
  "merchant_or_place",
  "receipt_item",
  "technical_context",
] satisfies AiFinanceDescriptionSource[];

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { enum: ["payment", "payments", "receipt", "transfer", "unknown"] },
    paymentType: { enum: ["expense", "income", null] },
    amount: { type: ["string", "null"] },
    originalAmount: { type: ["string", "null"] },
    originalCurrency: { type: ["string", "null"] },
    toAmount: { type: ["string", "null"] },
    totalAmount: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    descriptionSource: { enum: [...DESCRIPTION_SOURCES, null] },
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
          originalAmount: { type: ["string", "null"] },
          originalCurrency: { type: ["string", "null"] },
          currency: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          descriptionSource: { enum: [...DESCRIPTION_SOURCES, null] },
          merchant: { type: ["string", "null"] },
          dateText: { type: ["string", "null"] },
          accountHint: { type: ["string", "null"] },
          categoryHint: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "paymentType",
          "amount",
          "originalAmount",
          "originalCurrency",
          "currency",
          "description",
          "descriptionSource",
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
    "originalAmount",
    "originalCurrency",
    "toAmount",
    "totalAmount",
    "currency",
    "description",
    "descriptionSource",
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
      enum: [
        "create_draft",
        "update_entry",
        "delete_entry",
        "set_receipt_mode",
        "commit",
        "cancel",
        "ask_clarification",
      ],
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
  /(?:^|\s)(?:за|на|по)?\s*(\d+(?:[.,]\d{1,2})?)\s*(byn|br|бел(?:орусских)?\.?\s*руб(?:лей|ля|ль)?|руб(?:лей|ля|ль)?|р\.?|usd|\$|доллар(?:ов|а)?|бакс(?:ов|а)?|eur|€|евро|rub|₽|рос(?:сийских)?\.?\s*руб(?:лей|ля|ль)?)(?:\s|$)/iu;
const MONEY_MENTION_PATTERN =
  /(\d+(?:[.,]\d{1,2})?)\s*(byn|br|бел(?:орусских)?\.?\s*руб(?:лей|ля|ль)?|руб(?:лей|ля|ль)?|р\.?|usd|\$|доллар(?:ов|а)?|бакс(?:ов|а)?|eur|€|евро|rub|₽|рос(?:сийских)?\.?\s*руб(?:лей|ля|ль)?)/giu;
const BALANCE_DIFFERENCE_PATTERN =
  /(\d+(?:[.,]\d{1,2})?)\s*[-−]\s*(\d+(?:[.,]\d{1,2})?)\s*(byn|br|бел(?:орусских)?\.?\s*руб(?:лей|ля|ль)?|руб(?:лей|ля|ль)?|р\.?|usd|\$|доллар(?:ов|а)?|бакс(?:ов|а)?|eur|€|евро|rub|₽|рос(?:сийских)?\.?\s*руб(?:лей|ля|ль)?)/iu;
const CURRENCY_EXCHANGE_PATTERN =
  /(?:поменял|поменяла|обменял|обменяла|обмен|конвертировал|конвертировала|convert|exchange).*(?:получил|получила|получено|пришло|зачисл|got|received)|(?:получил|получила|получено|пришло|зачисл|got|received).*(?:поменял|поменяла|обменял|обменяла|обмен|конвертировал|конвертировала|convert|exchange)/iu;
const EXPENSE_TEXT_PATTERN = /(?:списал|списало|снял|сняло|потрат|оплат|купил|купила|расход|expense)/iu;
const INCOME_TEXT_PATTERN = /(?:пришло|зачисл|получил|получила|доход|income)/iu;
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

function isDescriptionSource(value: unknown): value is AiFinanceDescriptionSource | null {
  return (
    value === null || (typeof value === "string" && DESCRIPTION_SOURCES.includes(value as AiFinanceDescriptionSource))
  );
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

function normalizeCurrency(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) return null;

  if (normalizedValue === "$" || normalizedValue === "usd" || /доллар|бакс/.test(normalizedValue)) return "USD";
  if (normalizedValue === "€" || normalizedValue === "eur" || normalizedValue === "евро") return "EUR";
  if (normalizedValue === "₽" || normalizedValue === "rub" || normalizedValue.includes("рос")) return "RUB";

  return "BYN";
}

function getFallbackCurrency(context?: AiFinancePromptContext | null) {
  return (
    context?.accounts.find((account) => account.currency === "BYN")?.currency ?? context?.accounts[0]?.currency ?? "BYN"
  );
}

function getFallbackAccountHint(text: string) {
  const normalizedText = normalizeText(text);
  if (/(cash|налич)/i.test(normalizedText)) return "cash";
  if (/(белорус|беларус|byn|byr|руб)/i.test(normalizedText) && /карт/i.test(normalizedText)) return "BYN";
  if (/(card|карт)/i.test(normalizedText)) return "card";
  if (/(белорус|беларус|byn|byr|руб)/i.test(normalizedText)) return "BYN";
  return null;
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
        originalAmount: null,
        originalCurrency: null,
        currency: normalizeCurrency(match[2]) ?? getFallbackCurrency(context),
        description: getFallbackDescription(line) || line,
        descriptionSource: getFallbackCategoryHint(line, context) ? ("explicit_user_note" as const) : ("none" as const),
        merchant: null,
        dateText: null,
        accountHint: getFallbackAccountHint(line),
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
      originalAmount: payment.originalAmount,
      originalCurrency: payment.originalCurrency,
      currency: payment.currency,
      description: payment.description,
      descriptionSource: payment.descriptionSource,
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

function calculateBalanceDifference(text: string) {
  const match = text.match(BALANCE_DIFFERENCE_PATTERN);
  if (!match?.[1] || !match[2]) return null;

  const left = normalizeAmount(match[1]);
  const right = normalizeAmount(match[2]);
  const amount = new Big(left).minus(right).abs().round(2).toFixed(2);
  if (!isMoney(amount)) return null;

  return {
    amount,
    currency: normalizeCurrency(match[3]) ?? null,
    expression: `${match[1]}-${match[2]}`,
  };
}

function parseBalanceDifferencePayment(text: string): AiFinanceExtraction | null {
  const difference = calculateBalanceDifference(text);
  if (!difference) return null;

  const originalMoneyMentions = [...text.matchAll(MONEY_MENTION_PATTERN)]
    .map((match) => ({ amount: normalizeAmount(match[1] || ""), currency: normalizeCurrency(match[2]) }))
    .filter(
      (mention) =>
        mention.currency &&
        mention.currency !== difference.currency &&
        isMoney(mention.amount) &&
        !difference.expression.includes(mention.amount)
    );
  const original = originalMoneyMentions[0];

  const paymentType = INCOME_TEXT_PATTERN.test(text) && !EXPENSE_TEXT_PATTERN.test(text) ? "income" : "expense";

  return {
    kind: "payment",
    paymentType,
    amount: difference.amount,
    originalAmount: original?.amount ?? null,
    originalCurrency: original?.currency ?? null,
    currency: difference.currency ?? getFallbackCurrency(),
    description: null,
    descriptionSource: original ? "technical_context" : "none",
    merchant: null,
    dateText: null,
    accountHint: getFallbackAccountHint(text),
    categoryHint: null,
    confidence: 0.86,
  };
}

function parseCurrencyExchangeTransfer(text: string): AiFinanceExtraction | null {
  if (!CURRENCY_EXCHANGE_PATTERN.test(text)) return null;

  const mentions = [...text.matchAll(MONEY_MENTION_PATTERN)].map((match) => ({
    amount: normalizeAmount(match[1] || ""),
    currency: normalizeCurrency(match[2]),
  }));
  const [source, destination] = mentions;
  if (
    !source?.currency ||
    !destination?.currency ||
    source.currency === destination.currency ||
    !isMoney(source.amount) ||
    !isMoney(destination.amount)
  )
    return null;

  return {
    kind: "transfer",
    amount: source.amount,
    toAmount: destination.amount,
    fromAccountHint: source.currency,
    toAccountHint: destination.currency,
    dateText: null,
    description: null,
    descriptionSource: "none",
    confidence: 0.88,
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
    !isNullableString(value.originalAmount) ||
    !isNullableString(value.originalCurrency) ||
    !isNullableString(value.currency) ||
    !isNullableString(value.description) ||
    !isDescriptionSource(value.descriptionSource) ||
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
      !isNullableString(value.description) ||
      !isDescriptionSource(value.descriptionSource)
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
    value.action !== "delete_entry" &&
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
    const balanceDifferencePayment = parseBalanceDifferencePayment(text);
    if (balanceDifferencePayment) return balanceDifferencePayment;

    const currencyExchangeTransfer = parseCurrencyExchangeTransfer(text);
    if (currencyExchangeTransfer) return currencyExchangeTransfer;

    const content = await this.openRouter.createStructuredCompletion(
      [
        {
          role: "system",
          content: [
            "Extract Finnn finance intents from the user's message. If the message contains multiple independent payments, use kind=payments and include each payment separately. Treat currency exchange between the user's own accounts as kind=transfer with amount from the source account and toAmount received by the destination account, not as expense plus income. Return strict JSON only. Money amounts must stay strings. Always include every schema field; use null or [] for fields that do not apply to the selected kind.",
            "For descriptionSource use one of: none, explicit_user_note, merchant_or_place, receipt_item, technical_context. Set descriptionSource=null only for kinds where description cannot apply.",
            "Persistable descriptions must be useful extra context that is not already captured by type, amount, currency, accounts, category, or date. Examples: `Перевод с наличных на BSB Card` => description=null, descriptionSource=none. `Перевод на BSB Card, день рождения` => description=`день рождения`, descriptionSource=explicit_user_note. `Кофе в Surf Coffee 12 BYN` => description=`Surf Coffee`, merchant=`Surf Coffee`, descriptionSource=merchant_or_place.",
            "Never copy generic phrases like transfer from one account to another, move money, payment, purchase, or currency exchange into description.",
            "If the user provides before-after balances like 60.44-55.34 rubles/BYN, calculate the absolute difference and use that as the payment amount in the account currency. Put any visible foreign-card amount such as 2 USD into originalAmount/originalCurrency, not description. If a text is only technical context, use description=null and descriptionSource=technical_context.",
          ].join("\n"),
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
            "Use delete_entry when the user asks to remove, delete, drop, exclude, or undo one row from the current draft.",
            "Use commit only when the user clearly confirms the current draft.",
            "Use cancel only when the user clearly cancels.",
            "Use set_receipt_mode for requests to split/group receipts.",
            "Use create_draft only when the user explicitly asks to start a new operation.",
            "Use ask_clarification if the edit cannot be mapped to the current draft.",
            "For categoryName and accountName, use exact names from the provided lists only; otherwise null.",
            "entryIndex is 1-based when the user targets a numbered draft row; otherwise null.",
            "For delete_entry by amount, set amount to the amount mentioned by the user and targetText to any words that identify the row.",
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
        "If a transaction screenshot shows a foreign amount plus before-after account balances, calculate the account-currency amount from the balance difference, for example 60.44-55.34 BYN => 5.10 BYN. Put the visible foreign amount into originalAmount/originalCurrency, not description.",
        "For descriptionSource use none, explicit_user_note, merchant_or_place, receipt_item, or technical_context. Do not store generic transaction wording in description.",
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
