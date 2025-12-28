"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { registerSchema, type RegisterInput } from "../auth.validations";
import { registerAction } from "../auth.service";

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      const result = await registerAction(data);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        "Аккаунт создан! Письмо с подтверждением отправлено на ваш email."
      );
      router.push("/login");
    } catch {
      toast.error("Что-то пошло не так");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Регистрация</CardTitle>
        <CardDescription>Создайте новый аккаунт, чтобы начать</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Иван Иванов"
                className="pl-9"
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

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
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Минимум 6 символов"
                className="pl-9"
                {...register("password")}
                aria-invalid={errors.password ? "true" : "false"}
              />
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Создание аккаунта..." : "Создать аккаунт"}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <p className="text-xs text-center text-muted-foreground">
            После регистрации вам будет отправлено письмо с подтверждением email.
            Пожалуйста, проверьте вашу почту и перейдите по ссылке для активации аккаунта.
          </p>
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Уже есть аккаунт? </span>
            <Link href="/login" className="text-primary hover:underline">
              Войти
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
