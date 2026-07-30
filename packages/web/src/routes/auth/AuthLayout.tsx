import { Outlet } from "react-router";

import { ThemeSelector } from "@/modules/auth/components/appearance-settings/ThemeSelector";

import { AuthPageGuard } from "./AuthPageGuard";

export default function AuthLayout() {
  return (
    <div className="relative min-h-[100dvh] bg-background">
      <div className="pointer-events-none fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-50 sm:right-5">
        <div className="pointer-events-auto">
          <ThemeSelector title={null} showLabels={false} layout="fill" segmentedClassName="w-36 shadow-md" />
        </div>
      </div>
      <AuthPageGuard>
        <Outlet />
      </AuthPageGuard>
    </div>
  );
}
