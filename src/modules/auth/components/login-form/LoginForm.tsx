"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { acceptInvite } from "@/modules/workspace/workspace.service";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { type LoginInput, loginSchema } from "../../auth.validations";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const inviteToken = searchParams.get("inviteToken");

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("Email не подтвержден")) {
          toast.error("Email не подтвержден. Пожалуйста, проверьте вашу почту и подтвердите email.");
        } else {
          toast.error("Неверный email или пароль");
        }
        return;
      }

      if (inviteToken) {
        const acceptResult = await acceptInvite(inviteToken);
        if (acceptResult.error) {
          toast.error(acceptResult.error);
        } else {
          toast.success("Приглашение принято");
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Что-то пошло не так");
    } finally {
      setIsLoading(false);
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Вход..." : "Войти"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Нет аккаунта? </span>
          <Link href="/register" className="text-primary hover:underline">
            Зарегистрироваться
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
