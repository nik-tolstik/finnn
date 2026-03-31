import { tool } from "ai";

import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";

import {
  debtsOverviewInputSchema,
  emptyAssistantInputSchema,
  flowAnalysisInputSchema,
  recentTransactionsInputSchema,
} from "./assistant-tool.schemas";
import type { AssistantToolContext } from "./assistant-tool.types";
import { buildCashFlowAnalysis } from "./cash-flow-analysis";
import { buildDebtsOverview } from "./debts-overview";
import { buildRecentTransactions } from "./recent-transactions";
import { buildWorkspaceOverview } from "./workspace-overview";

export function createAssistantTools({ workspaceId, baseCurrency }: AssistantToolContext) {
  return {
    getWorkspaceOverview: tool({
      description: "Получить краткую сводку по текущему workspace: счета, общий баланс, открытые долги",
      inputSchema: emptyAssistantInputSchema,
      execute: async () => buildWorkspaceOverview(workspaceId),
    }),
    getSpendingAnalysis: tool({
      description:
        'Проанализировать расходы за период, с группировкой по категориям и счетам. Если пользователь указал относительный период вроде "за полгода" или "за месяц", нужно сразу использовать его как период от текущей даты, без уточняющего вопроса.',
      inputSchema: flowAnalysisInputSchema,
      execute: async (input) => buildCashFlowAnalysis(workspaceId, baseCurrency, PaymentTransactionType.EXPENSE, input),
    }),
    getIncomeAnalysis: tool({
      description:
        'Проанализировать доходы за период, с группировкой по категориям и счетам. Если пользователь указал относительный период вроде "за полгода" или "за месяц", нужно сразу использовать его как период от текущей даты, без уточняющего вопроса.',
      inputSchema: flowAnalysisInputSchema,
      execute: async (input) => buildCashFlowAnalysis(workspaceId, baseCurrency, PaymentTransactionType.INCOME, input),
    }),
    getRecentTransactions: tool({
      description:
        'Получить список последних операций за период: расходы, доходы, переводы и долговые операции. Если пользователь указал относительный период вроде "за полгода" или "за месяц", нужно сразу использовать его как период от текущей даты, без уточняющего вопроса.',
      inputSchema: recentTransactionsInputSchema,
      execute: async (input) => buildRecentTransactions(workspaceId, input),
    }),
    getDebtsOverview: tool({
      description: "Получить сводку по долгам с фильтрами по статусу и типу",
      inputSchema: debtsOverviewInputSchema,
      execute: async (input) => buildDebtsOverview(workspaceId, baseCurrency, input),
    }),
  };
}
