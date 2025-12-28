import { Suspense } from "react";
import { LoginForm } from "@/modules/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense fallback={<div>Загрузка...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
