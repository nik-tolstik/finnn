import { PasswordResetRequestForm } from "@/modules/auth/components/password-reset-request-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <PasswordResetRequestForm />
    </div>
  );
}
