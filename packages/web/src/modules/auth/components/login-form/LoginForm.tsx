"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getSession, login } from "@/shared/api/generated/auth/auth";
import { acceptWorkspaceInvite } from "@/shared/api/generated/workspace-invites/workspace-invites";
import { apiSessionQueryKey, userRequiresEmailVerification } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { type LoginInput, loginSchema } from "../../auth.validations";
import { redirectToGoogleAuth } from "../../google-auth-url";
import { redirectToTelegramAuth } from "../../telegram-auth-url";
import { GoogleAuthButton } from "../google-auth-button";
import { TelegramAuthButton } from "../telegram-auth-button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const inviteToken = searchParams.get("inviteToken");
  const telegramError = searchParams.get("telegramError");
  const googleError = searchParams.get("googleError");
  const isLoading = isSubmitting || isPending;

  useEffect(() => {
    if (telegramError) {
      toast.error("Не удалось войти через Telegram");
    }
    if (googleError) {
      toast.error("Не удалось войти через Google");
    }
  }, [googleError, telegramError]);

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true);
    try {
      await login({
        email: data.email,
        password: data.password,
      });

      const sessionResponse = await queryClient.fetchQuery({
        queryKey: apiSessionQueryKey,
        queryFn: getSession,
        staleTime: 0,
      });

      if (!sessionResponse.authenticated || !sessionResponse.user) {
        throw new Error("Сессия не была создана. Проверьте адрес web/API и настройки cookie.");
      }

      if (userRequiresEmailVerification(sessionResponse.user)) {
        const returnTo = inviteToken ? `/invite/${inviteToken}` : "/dashboard";
        startTransition(() => {
          router.replace(`/email-required?returnTo=${encodeURIComponent(returnTo)}`);
          router.refresh();
        });
        return;
      }

      if (inviteToken) {
        await acceptWorkspaceInvite(inviteToken);
        toast.success("Приглашение принято");
      }

      startTransition(() => {
        router.replace("/dashboard");
        router.refresh();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Что-то пошло не так";
      toast.error(message.includes("Email не подтвержден") ? message : message || "Неверный email или пароль");
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-screen h-screen sm:h-auto sm:w-full sm:max-w-md m-0 sm:m-0 rounded-none sm:rounded-lg flex flex-col justify-center gap-6">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Вход</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Электронная почта</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="example@mail.com"
                className="pl-9"
                {...register("email")}
                aria-invalid={errors.email ? "true" : "false"}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Введите пароль"
                className="pl-9 pr-9"
                {...register("password")}
                aria-invalid={errors.password ? "true" : "false"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Забыли пароль?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Вход..." : "Войти"}
          </Button>
        </form>

        <div className="mt-3 grid gap-2">
          <GoogleAuthButton
            disabled={isLoading}
            onClick={() => redirectToGoogleAuth(inviteToken ? `/invite/${inviteToken}` : "/dashboard")}
          />
          <TelegramAuthButton
            disabled={isLoading}
            onClick={() => redirectToTelegramAuth(inviteToken ? `/invite/${inviteToken}` : "/dashboard")}
          />
        </div>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Нет аккаунта? </span>
          <Link
            href={inviteToken ? `/register?inviteToken=${encodeURIComponent(inviteToken)}` : "/register"}
            className="text-primary hover:underline"
          >
            Зарегистрироваться
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
