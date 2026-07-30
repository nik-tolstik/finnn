import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

import { Toaster } from "./Sonner";

const meta = {
  title: "Shared UI/Toast",
  component: Toaster,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToastGallery() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-2xl flex-col justify-center gap-6">
      <div>
        <h2 className="text-lg font-semibold">Toast variants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the controls below to preview the notifications used across Finnn.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button variant="secondary" onClick={() => toast("Изменения сохранены")}>
          Default
        </Button>
        <Button variant="secondary" onClick={() => toast.success("Счёт создан")}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.info("Данные обновляются")}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => toast.warning("Проверьте валюту счёта")}>
          Warning
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Не удалось сохранить изменения")}>
          Error
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const loadingToastId = toast.loading("Синхронизация данных...", {
              description: "Это уведомление обновится автоматически",
            });

            window.setTimeout(() => {
              toast.success("Синхронизация завершена", { id: loadingToastId });
            }, 2000);
          }}
        >
          Loading
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast("Новое приглашение в рабочий стол", {
              description: "Анна добавила вас в рабочий стол «Семейный бюджет».",
              action: {
                label: "Открыть",
                onClick: () => toast.success("Приглашение открыто"),
              },
            })
          }
        >
          With action
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.promise(new Promise((resolve) => window.setTimeout(resolve, 2000)), {
              loading: "Экспорт базы данных...",
              success: "База данных экспортирована",
              error: "Не удалось экспортировать базу данных",
            })
          }
        >
          Promise
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.success("Операция выполнена", {
              description: "Это уведомление останется открытым, пока вы его не закроете.",
              duration: Number.POSITIVE_INFINITY,
              closeButton: true,
            })
          }
        >
          Persistent
        </Button>
      </div>

      <Toaster />
    </div>
  );
}

export const Playground: Story = {
  render: () => <ToastGallery />,
};
