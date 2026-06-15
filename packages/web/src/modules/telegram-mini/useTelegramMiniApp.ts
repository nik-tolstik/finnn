"use client";

import { createContext, useContext } from "react";

import type { TelegramMiniAppState } from "./telegram-mini.types";

export const initialTelegramMiniAppState: TelegramMiniAppState = {
  error: null,
  isPending: false,
  isTelegramMiniApp: false,
  status: "idle",
};

export const TelegramMiniAppContext = createContext<TelegramMiniAppState>(initialTelegramMiniAppState);

export function useTelegramMiniApp(): TelegramMiniAppState {
  return useContext(TelegramMiniAppContext);
}
