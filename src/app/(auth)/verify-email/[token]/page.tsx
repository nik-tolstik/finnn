"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { verifyEmail } from "@/modules/auth/auth.service";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        const token = params.token as string;
        
        if (!token) {
          setError("Токен не найден");
          setStatus("error");
          toast.error("Токен не найден");
          return;
        }

        const result = await verifyEmail(token);
        if (result.error) {
          setError(result.error);
          setStatus("error");
          toast.error(result.error);
        } else {
          setStatus("success");
          toast.success("Email успешно подтвержден");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } catch {
        setError("Не удалось подтвердить email");
        setStatus("error");
        toast.error("Не удалось подтвердить email");
      }
    };

    verify();
  }, [params.token, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Подтверждение email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email подтвержден</CardTitle>
            <CardDescription>
              Ваш email успешно подтвержден. Вы будете перенаправлены на страницу входа.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Перейти на страницу входа
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Ошибка подтверждения</CardTitle>
          <CardDescription>{error || "Не удалось подтвердить email"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/login")} className="w-full">
            Перейти на страницу входа
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

