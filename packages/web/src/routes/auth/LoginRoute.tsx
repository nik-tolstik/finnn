import { LoginForm } from "@/modules/auth/components/login-form";

export default function LoginRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-0 sm:p-4">
      <LoginForm />
    </div>
  );
}
