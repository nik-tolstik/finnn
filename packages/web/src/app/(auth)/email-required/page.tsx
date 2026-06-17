import { Suspense } from "react";

import { EmailRequiredScreen } from "@/modules/auth/components/email-required";

export default function EmailRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <Suspense fallback={<div>Загрузка...</div>}>
        <EmailRequiredScreen />
      </Suspense>
    </div>
  );
}
