"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button } from "@/shared/ui/button";

type TelegramAuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

function TelegramLogo() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M21.7 4.3 18.4 20c-.2 1-.8 1.2-1.6.7l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.5-.2L7 14 2.5 12.6c-1-.3-1-1 0-1.4L20.3 4c.8-.3 1.6.2 1.4.3Z"
        fill="#229ED9"
      />
    </svg>
  );
}

export function TelegramAuthButton({ disabled, ...props }: TelegramAuthButtonProps) {
  return (
    <Button type="button" variant="outline" className="w-full bg-transparent" disabled={disabled} {...props}>
      <TelegramLogo />
      Продолжить с Telegram
    </Button>
  );
}
