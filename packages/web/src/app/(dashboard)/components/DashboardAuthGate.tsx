"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { useSession } from "@/shared/lib/api-session-client";

interface DashboardAuthGateProps {
  children: ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return <AppLoadingScreen />;
  }

  return children;
}
