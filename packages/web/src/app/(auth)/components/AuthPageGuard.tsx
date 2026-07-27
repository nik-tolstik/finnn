"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { userRequiresEmailVerification, useSession } from "@/shared/lib/api-session-client";

const AUTH_ONLY_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

export function AuthPageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthOnlyPage = AUTH_ONLY_PATHS.has(pathname);

  useEffect(() => {
    if (!isAuthOnlyPage || status !== "authenticated") {
      return;
    }

    if (userRequiresEmailVerification(session?.user)) {
      router.replace(`/email-required?returnTo=${encodeURIComponent("/dashboard")}`);
      return;
    }

    router.replace("/dashboard");
  }, [isAuthOnlyPage, router, session?.user, status]);

  if (isAuthOnlyPage && (status === "loading" || status === "authenticated")) {
    return <AppLoadingScreen />;
  }

  return children;
}
