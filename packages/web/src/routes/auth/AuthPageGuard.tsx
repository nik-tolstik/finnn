import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { userRequiresEmailVerification, useSession } from "@/shared/lib/api-session";

const AUTH_ONLY_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

export function AuthPageGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: session, status } = useSession();
  const isAuthOnlyPage = AUTH_ONLY_PATHS.has(pathname);

  useEffect(() => {
    if (!isAuthOnlyPage || status !== "authenticated") {
      return;
    }

    if (userRequiresEmailVerification(session?.user)) {
      navigate(`/email-required?returnTo=${encodeURIComponent("/dashboard")}`, { replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  }, [isAuthOnlyPage, navigate, session?.user, status]);

  if (isAuthOnlyPage && (status === "loading" || status === "authenticated")) {
    return <AppLoadingScreen />;
  }

  return children;
}
