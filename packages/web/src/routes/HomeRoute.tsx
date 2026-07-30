import { useEffect } from "react";
import { useNavigate } from "react-router";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";
import { useSession } from "@/shared/lib/api-session";

export default function HomeRoute() {
  const navigate = useNavigate();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (status === "unauthenticated") {
      navigate("/login", { replace: true });
    }
  }, [navigate, status]);

  return <AppLoadingScreen />;
}
