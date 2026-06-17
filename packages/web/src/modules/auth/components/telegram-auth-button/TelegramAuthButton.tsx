"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button } from "@/shared/ui/button";

import { TelegramIcon } from "../social-provider-icons";

type TelegramAuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function TelegramAuthButton({ disabled, ...props }: TelegramAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="group relative h-11 w-full overflow-hidden rounded-lg border-border bg-background px-3 text-foreground shadow-sm hover:border-[#229ED9]/60 hover:bg-background hover:text-foreground hover:shadow-md dark:border-white/15 dark:bg-white/[0.06] dark:text-foreground dark:hover:bg-white/[0.09]"
      disabled={disabled}
      {...props}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-[#229ED9]" />
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#229ED9]/10 shadow-sm ring-1 ring-[#229ED9]/20 transition-transform group-hover:scale-105 dark:bg-[#229ED9]/15"
        aria-hidden="true"
      >
        <TelegramIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 text-center text-sm font-semibold">Продолжить с Telegram</span>
      <span className="size-7 shrink-0" aria-hidden="true" />
    </Button>
  );
}
