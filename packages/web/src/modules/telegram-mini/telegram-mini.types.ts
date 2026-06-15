export type TelegramMiniAppBootstrapStatus = "idle" | "pending" | "authenticated" | "failed";

export type TelegramMiniAppState = {
  error: string | null;
  isPending: boolean;
  isTelegramMiniApp: boolean;
  status: TelegramMiniAppBootstrapStatus;
};

type TelegramWebApp = {
  initData?: string;
  expand?: () => void;
  ready?: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
