"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { acceptWorkspaceInvite, getWorkspaceInvite } from "@/shared/api/generated/workspace-invites/workspace-invites";
import { useSession } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
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
        if (!token) {
          setError("Токен не найден");
          setIsLoading(false);
          return;
        }

        const result = await getWorkspaceInvite(token);
        setInviteData({
          email: result.invite.email,
          workspaceName: result.invite.workspaceName,
        });
        setIsLoading(false);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Не удалось загрузить приглашение");
        setIsLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  useEffect(() => {
    const acceptInviteIfLoggedIn = async () => {
      if (status === "authenticated" && session?.user && inviteData) {
        if (session.user.email !== inviteData.email) {
          setError("Email приглашения не совпадает с вашим аккаунтом");
          return;
        }

        try {
          if (!token) {
            setError("Токен не найден");
            return;
          }

          await acceptWorkspaceInvite(token);
          toast.success("Приглашение принято");
          router.push("/dashboard");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось принять приглашение";
          toast.error(message);
          setError(message);
        }
      }
    };

    acceptInviteIfLoggedIn();
  }, [status, session, inviteData, token, router]);

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
