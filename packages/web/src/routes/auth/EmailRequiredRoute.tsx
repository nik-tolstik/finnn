import { EmailRequiredScreen } from "@/modules/auth/components/email-required";

export default function EmailRequiredRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <EmailRequiredScreen />
    </div>
  );
}
