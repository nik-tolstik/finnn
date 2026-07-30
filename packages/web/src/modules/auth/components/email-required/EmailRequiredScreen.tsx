import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, LogOut, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { requestEmailVerification } from "@/shared/api/generated/auth/auth";
import { userRequiresEmailVerification, useSession, useSignOut } from "@/shared/lib/api-session";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function sanitizeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function EmailRequiredScreen() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [searchParams] = useSearchParams();
  const { data: session, status, update: updateSession } = useSession();
  const [email, setEmail] = useState(session?.user.email ?? "");
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/login", { replace: true });
      return;
    }

    if (status === "authenticated" && !userRequiresEmailVerification(session?.user)) {
      navigate(returnTo, { replace: true });
    }
  }, [navigate, returnTo, session?.user, status]);

  useEffect(() => {
    setEmail(session?.user.email ?? "");
  }, [session?.user.email]);

  const emailMutation = useMutation({
    mutationFn: () => requestEmailVerification({ email }),
    onSuccess: async () => {
      await updateSession();
      toast.success("Письмо подтверждения отправлено");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось отправить подтверждение email");
    },
  });

  const refreshSession = async () => {
    const nextSession = await updateSession();
    if (nextSession && !userRequiresEmailVerification(nextSession.user)) {
      navigate(returnTo, { replace: true });
      return;
    }

    toast.message("Email пока не подтвержден");
  };

  return (
    <Card className="flex h-screen w-screen flex-col justify-center gap-6 rounded-none sm:h-auto sm:w-full sm:max-w-md sm:rounded-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Подтвердите email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Электронная почта</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@mail.com"
              className="pl-9"
              disabled={emailMutation.isPending}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Button type="button" disabled={!email || emailMutation.isPending} onClick={() => emailMutation.mutate()}>
            {emailMutation.isPending ? "Отправка..." : "Отправить письмо"}
          </Button>
          <Button type="button" variant="secondary" onClick={refreshSession}>
            <CheckCircle2 className="h-4 w-4" />Я подтвердил email
          </Button>
          <Button type="button" variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
