"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { acceptInvite, getWorkspaceInvite } from "@/modules/workspace/workspace.service";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [inviteData, setInviteData] = useState<{
    email: string;
    workspaceName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        const token = params.token as string;
        if (!token) {
          setError("Токен не найден");
          setIsLoading(false);
          return;
        }

        const result = await getWorkspaceInvite(token);
        if (result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }
        setInviteData({
          email: result.data?.email,
          workspaceName: result.data?.workspaceName,
        });
        setIsLoading(false);
      } catch {
        setError("Не удалось загрузить приглашение");
        setIsLoading(false);
      }
    };

    loadInvite();
  }, [params.token]);

  useEffect(() => {
    const acceptInviteIfLoggedIn = async () => {
      if (status === "authenticated" && session?.user && inviteData) {
        if (session.user.email !== inviteData.email) {
          setError("Email приглашения не совпадает с вашим аккаунтом");
          return;
        }

        try {
          const token = params.token as string;
          if (!token) {
            setError("Токен не найден");
            return;
          }

          const result = await acceptInvite(token);
          if (result.error) {
            toast.error(result.error);
            setError(result.error);
          } else {
            toast.success("Приглашение принято");
            router.push("/dashboard");
          }
        } catch {
          toast.error("Не удалось принять приглашение");
          setError("Не удалось принять приглашение");
        }
      }
    };

    acceptInviteIfLoggedIn();
  }, [status, session, inviteData, params.token, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Загрузка...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>{error}</CardDescription>
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

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Принятие приглашения...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Приглашение в рабочий стол</CardTitle>
          <CardDescription>
            Вы были приглашены присоединиться к рабочему столу <strong>{inviteData?.workspaceName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Для принятия приглашения необходимо войти в систему.</p>
          <Button
            onClick={() => {
              const token = params.token as string;
              router.push(`/login?inviteToken=${token}`);
            }}
            className="w-full"
          >
            Войти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
