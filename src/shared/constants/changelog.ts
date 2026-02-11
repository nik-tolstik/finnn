export const APP_VERSION = "0.1.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  features: string[];
  fixes?: string[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2025-02-12",
    features: [
      "Управление счетами и транзакциями",
      "Аналитика расходов",
      "Учёт долгов",
      "Курсы валют в реальном времени",
    ],
  },
];
