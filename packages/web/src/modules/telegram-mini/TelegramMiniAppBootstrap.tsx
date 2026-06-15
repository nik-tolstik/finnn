"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/shared/lib/api-session-client";

import { createTelegramMiniAppSessionFromInitData } from "./telegram-mini.api";
import type { TelegramMiniAppState } from "./telegram-mini.types";
import { initialTelegramMiniAppState, TelegramMiniAppContext } from "./useTelegramMiniApp";

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Не удалось войти через Telegram";
}

export function TelegramMiniAppBootstrap({ children }: { children: ReactNode }) {
  const { status: sessionStatus, update } = useSession();
  const [state, setState] = useState<TelegramMiniAppState>(initialTelegramMiniAppState);
  const initializedRef = useRef(false);
  const attemptedInitDataRef = useRef<string | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) {
      setState(initialTelegramMiniAppState);
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      webApp.ready?.();
      webApp.expand?.();
    }

    const initData = webApp.initData;
    if (!initData) {
      setState({
        error: null,
        isPending: false,
        isTelegramMiniApp: true,
        status: "idle",
      });
      return;
    }

    if (sessionStatus === "loading") {
      setState({
        error: null,
        isPending: true,
        isTelegramMiniApp: true,
        status: "pending",
      });
      return;
    }

    if (sessionStatus === "authenticated") {
      setState({
        error: null,
        isPending: false,
        isTelegramMiniApp: true,
        status: "authenticated",
      });
      return;
    }

    if (attemptedInitDataRef.current === initData) return;
    attemptedInitDataRef.current = initData;

    let cancelled = false;
    setState({
      error: null,
      isPending: true,
      isTelegramMiniApp: true,
      status: "pending",
    });

    createTelegramMiniAppSessionFromInitData(initData)
      .then(async () => {
        const session = await update();
        if (!session) {
          throw new Error("Не удалось подтвердить сессию Telegram");
        }

        if (!cancelled) {
          setState({
            error: null,
            isPending: false,
            isTelegramMiniApp: true,
            status: "authenticated",
          });
        }
      })
      .catch((error: unknown) => {
        const message = getErrorMessage(error);
        toast.error(message);
        if (!cancelled) {
          setState({
            error: message,
            isPending: false,
            isTelegramMiniApp: true,
            status: "failed",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, update]);

  const value = useMemo(() => state, [state]);

  return <TelegramMiniAppContext.Provider value={value}>{children}</TelegramMiniAppContext.Provider>;
}
