"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { useSession } from "@/shared/lib/api-session-client";

export function HomePageClient() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  return <AppLoadingScreen />;
}
