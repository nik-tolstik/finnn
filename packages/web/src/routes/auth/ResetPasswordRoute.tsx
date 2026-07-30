import { PasswordResetConfirmForm } from "@/modules/auth/components/password-reset-confirm-form";

export default function ResetPasswordRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <PasswordResetConfirmForm />
    </div>
  );
}
