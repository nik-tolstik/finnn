"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestPasswordReset } from "@/shared/api/generated/auth/auth";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { type PasswordResetRequestInput, passwordResetRequestSchema } from "../../auth.validations";

export function PasswordResetRequestForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
  });

  const onSubmit = async (data: PasswordResetRequestInput) => {
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email: data.email });
      toast.success("Если email зарегистрирован, код восстановления отправлен");
      router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить код");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="flex h-screen w-screen flex-col justify-center gap-6 rounded-none sm:h-auto sm:w-full sm:max-w-md sm:rounded-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Восстановление пароля</CardTitle>
      </CardHeader>
      <CardContent>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Отправка..." : "Получить код"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
