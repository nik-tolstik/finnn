import { RegisterForm } from "@/modules/auth/components/register-form";

export default function RegisterRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <RegisterForm />
    </div>
  );
}
