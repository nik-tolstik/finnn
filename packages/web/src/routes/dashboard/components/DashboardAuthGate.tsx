import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useTelegramMiniApp } from "@/modules/telegram-mini/useTelegramMiniApp";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { userRequiresEmailVerification, useSession } from "@/shared/lib/api-session";
import { workspacesKeys } from "@/shared/lib/query-keys";

interface DashboardAuthGateProps {
  children: ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { data: session, status } = useSession();
  const telegramMiniApp = useTelegramMiniApp();

  useQuery({
    queryKey: workspacesKeys.list(),
    queryFn: () => getWorkspaces(),
    enabled: status === "authenticated" && !userRequiresEmailVerification(session?.user),
    staleTime: 5000,
  });

  useEffect(() => {
    if (status === "unauthenticated" && !telegramMiniApp.isPending && telegramMiniApp.status !== "authenticated") {
      navigate("/login", { replace: true });
      return;
    }

    if (status === "authenticated" && userRequiresEmailVerification(session?.user)) {
      const query = searchParams.toString();
      const returnTo = `${pathname}${query ? `?${query}` : ""}${hash}`;
      navigate(`/email-required?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [
    hash,
    navigate,
    pathname,
    searchParams,
    session?.user,
    status,
    telegramMiniApp.isPending,
    telegramMiniApp.status,
  ]);

  if (status !== "authenticated" || telegramMiniApp.isPending || userRequiresEmailVerification(session?.user)) {
    return <AppLoadingScreen />;
  }

  return children;
}
