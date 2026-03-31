import { z } from "zod";

export const emptyAssistantInputSchema = z.object({});

export const assistantDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Дата в формате YYYY-MM-DD");

export const dateRangeInputSchema = z.object({
  dateFrom: assistantDateSchema
    .optional()
    .describe("Начало периода в формате YYYY-MM-DD, если нужно передать точный диапазон"),
  dateTo: assistantDateSchema
    .optional()
    .describe("Конец периода в формате YYYY-MM-DD, если нужно передать точный диапазон"),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      'Если пользователь задал относительный период без точных дат, передай количество последних дней. Примеры: "за неделю" -> 7, "за месяц" -> 30, "за квартал" -> 90, "за полгода" -> 183, "за год" -> 365. Не нужно задавать уточняющий вопрос для таких формулировок.'
    ),
});

export const recentTransactionsInputSchema = dateRangeInputSchema.extend({
  limit: z.number().int().min(1).max(20).optional().describe("Сколько последних операций вернуть"),
  kind: z.enum(["all", "expense", "income", "transfer", "debt"]).optional().describe("Какой тип операций искать"),
});

export const flowAnalysisInputSchema = dateRangeInputSchema.extend({
  limit: z.number().int().min(1).max(10).optional().describe("Сколько категорий и счетов показать"),
  accountName: z.string().min(1).max(80).optional().describe("Необязательный фильтр по названию счета"),
  categoryName: z.string().min(1).max(80).optional().describe("Необязательный фильтр по названию категории"),
});

export const debtsOverviewInputSchema = z.object({
  status: z.enum(["open", "closed", "all"]).optional().describe("Статус долгов"),
  type: z.enum(["lent", "borrowed", "all"]).optional().describe("Тип долга"),
  limit: z.number().int().min(1).max(20).optional().describe("Сколько записей показать"),
});

export type DateRangeInput = z.infer<typeof dateRangeInputSchema>;
export type RecentTransactionsInput = z.infer<typeof recentTransactionsInputSchema>;
export type FlowAnalysisInput = z.infer<typeof flowAnalysisInputSchema>;
export type DebtsOverviewInput = z.infer<typeof debtsOverviewInputSchema>;
