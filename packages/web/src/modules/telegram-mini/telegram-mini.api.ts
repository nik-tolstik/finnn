import { createTelegramMiniAppSession } from "@/shared/api/generated/auth/auth";

export async function createTelegramMiniAppSessionFromInitData(initData: string) {
  return createTelegramMiniAppSession({ initData });
}
