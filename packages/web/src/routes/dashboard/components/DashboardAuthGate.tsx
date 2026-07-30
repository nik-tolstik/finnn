import { type ReactNode, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useTelegramMiniApp } from "@/modules/telegram-mini/useTelegramMiniApp";
import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { userRequiresEmailVerification, useSession } from "@/shared/lib/api-session";

interface DashboardAuthGateProps {
  children: ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: session, status } = useSession();
  const telegramMiniApp = useTelegramMiniApp();

  useEffect(() => {
    if (status === "unauthenticated" && !telegramMiniApp.isPending && telegramMiniApp.status !== "authenticated") {
      navigate("/login", { replace: true });
      return;
    }

    if (status === "authenticated" && userRequiresEmailVerification(session?.user)) {
      const query = searchParams.toString();
      const returnTo = `${pathname}${query ? `?${query}` : ""}`;
      navigate(`/email-required?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [navigate, pathname, searchParams, session?.user, status, telegramMiniApp.isPending, telegramMiniApp.status]);

  if (status !== "authenticated" || telegramMiniApp.isPending || userRequiresEmailVerification(session?.user)) {
    return <AppLoadingScreen />;
  }

  return children;
}
