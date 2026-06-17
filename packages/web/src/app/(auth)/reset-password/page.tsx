import { Suspense } from "react";

import { PasswordResetConfirmForm } from "@/modules/auth/components/password-reset-confirm-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <Suspense fallback={<div>Загрузка...</div>}>
        <PasswordResetConfirmForm />
      </Suspense>
    </div>
  );
}
