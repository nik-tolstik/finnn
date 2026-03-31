export const ASSISTANT_CHAT_ID_PREFIX = "assistant:";

export const ASSISTANT_SUGGESTED_PROMPTS = [
  "Сколько я потратил за последние 30 дней?",
  "Какие категории трат самые большие в этом месяце?",
  "Покажи последние операции по workspace",
  "Какие долги сейчас открыты?",
] as const;

export const ASSISTANT_TOOL_LABELS = {
  getWorkspaceOverview: "Сводка по workspace",
  getSpendingAnalysis: "Анализ расходов",
  getIncomeAnalysis: "Анализ доходов",
  getRecentTransactions: "Последние операции",
  getDebtsOverview: "Сводка по долгам",
} as const;

export type AssistantToolLabelKey = keyof typeof ASSISTANT_TOOL_LABELS;

export function getAssistantToolLabel(toolName: string) {
  return ASSISTANT_TOOL_LABELS[toolName as AssistantToolLabelKey] ?? toolName;
}
