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

export type TelegramMiniAppSdkLoadResult = "loaded" | "failed";

declare global {
  interface Window {
    __finnnTelegramMiniAppSdkReady?: Promise<TelegramMiniAppSdkLoadResult>;
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
