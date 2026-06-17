"use client";

import { Button } from "@/shared/ui/button";

interface GoogleAuthButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function GoogleAuthButton({ disabled, onClick }: GoogleAuthButtonProps) {
  return (
    <Button type="button" variant="outline" className="w-full gap-2" disabled={disabled} onClick={onClick}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold">G</span>
      Продолжить с Google
    </Button>
  );
}
