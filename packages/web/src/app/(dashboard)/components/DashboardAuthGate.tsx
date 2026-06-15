"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useTelegramMiniApp } from "@/modules/telegram-mini/useTelegramMiniApp";
import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { useSession } from "@/shared/lib/api-session-client";

interface DashboardAuthGateProps {
  children: ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const router = useRouter();
  const { status } = useSession();
  const telegramMiniApp = useTelegramMiniApp();

  useEffect(() => {
    if (status === "unauthenticated" && !telegramMiniApp.isPending && telegramMiniApp.status !== "authenticated") {
      router.replace("/login");
    }
  }, [router, status, telegramMiniApp.isPending, telegramMiniApp.status]);

  if (status !== "authenticated" || telegramMiniApp.isPending) {
    return <AppLoadingScreen />;
  }

  return children;
}
