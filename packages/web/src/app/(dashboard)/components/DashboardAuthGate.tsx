"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useTelegramMiniApp } from "@/modules/telegram-mini/useTelegramMiniApp";
import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { userRequiresEmailVerification, useSession } from "@/shared/lib/api-session-client";

interface DashboardAuthGateProps {
  children: ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const telegramMiniApp = useTelegramMiniApp();

  useEffect(() => {
    if (status === "unauthenticated" && !telegramMiniApp.isPending && telegramMiniApp.status !== "authenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && userRequiresEmailVerification(session?.user)) {
      const query = searchParams.toString();
      const returnTo = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(`/email-required?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [pathname, router, searchParams, session?.user, status, telegramMiniApp.isPending, telegramMiniApp.status]);

  if (status !== "authenticated" || telegramMiniApp.isPending || userRequiresEmailVerification(session?.user)) {
    return <AppLoadingScreen />;
  }

  return children;
}
