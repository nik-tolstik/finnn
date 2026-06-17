"use client";

import { Button } from "@/shared/ui/button";

import { GoogleIcon } from "../social-provider-icons";

interface GoogleAuthButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function GoogleAuthButton({ disabled, onClick }: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="group relative h-11 w-full overflow-hidden rounded-lg border-border bg-background px-3 text-foreground shadow-sm hover:border-[#4285F4]/60 hover:bg-background hover:text-foreground hover:shadow-md dark:border-white/15 dark:bg-white/[0.06] dark:text-foreground dark:hover:bg-white/[0.09]"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#EA4335_0%,#FBBC05_34%,#34A853_66%,#4285F4_100%)]" />
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/10 transition-transform group-hover:scale-105"
        aria-hidden="true"
      >
        <GoogleIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 text-center text-sm font-semibold">Продолжить с Google</span>
      <span className="size-7 shrink-0" aria-hidden="true" />
    </Button>
  );
}
