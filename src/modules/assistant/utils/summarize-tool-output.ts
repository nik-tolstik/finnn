function formatDaysLabel(days: number) {
  const lastTwoDigits = days % 100;
  const lastDigit = days % 10;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${days} день`;
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${days} дня`;
  }

  return `${days} дней`;
}

function formatPeriodSummary(period: string) {
  const recentDaysMatch = /^Последние (\d+) дн\.$/.exec(period);

  if (recentDaysMatch) {
    const days = Number.parseInt(recentDaysMatch[1], 10);

    if (!Number.isNaN(days)) {
      return `за последние ${formatDaysLabel(days)}`;
    }
  }

  const dateRangeMatch = /^(\d{2}\.\d{2}\.\d{4}) - (\d{2}\.\d{2}\.\d{4})$/.exec(period);

  if (dateRangeMatch) {
    const [, startDate, endDate] = dateRangeMatch;
    return `за период с ${startDate} по ${endDate}`;
  }

  return `за период ${period}`;
}

export function summarizeAssistantToolOutput(toolName: string, output: unknown) {
  if (!output || typeof output !== "object") {
    return "Данные получены";
  }

  const result = output as Record<string, unknown>;

  if (toolName === "getWorkspaceOverview") {
    const balance = typeof result.totalBalanceInBaseCurrency === "string" ? result.totalBalanceInBaseCurrency : null;
    const openDebts =
      typeof result.totalOpenDebtsInBaseCurrency === "string" ? result.totalOpenDebtsInBaseCurrency : null;

    if (balance && openDebts) {
      return `Баланс: ${balance}. Открытые долги: ${openDebts}.`;
    }
  }

  if (toolName === "getSpendingAnalysis" || toolName === "getIncomeAnalysis") {
    if (result.noData === true) {
      return typeof result.reason === "string" ? result.reason : "Нет данных за выбранный период";
    }

    const total = typeof result.totalInBaseCurrency === "string" ? result.totalInBaseCurrency : null;
    const period = typeof result.period === "string" ? result.period : null;

    if (total && period) {
      return `${total} ${formatPeriodSummary(period)}`;
    }
  }

  if (toolName === "getRecentTransactions") {
    const totalReturned = typeof result.totalReturned === "number" ? result.totalReturned : null;
    const period = typeof result.period === "string" ? result.period : null;

    if (totalReturned !== null && period) {
      return `${totalReturned} операций ${formatPeriodSummary(period)}`;
    }
  }

  if (toolName === "getDebtsOverview") {
    const totalCount = typeof result.totalCount === "number" ? result.totalCount : null;
    const total = typeof result.totalInBaseCurrency === "string" ? result.totalInBaseCurrency : null;

    if (totalCount !== null && total) {
      return `${totalCount} записей, сумма ${total}`;
    }
  }

  return "Данные получены";
}
