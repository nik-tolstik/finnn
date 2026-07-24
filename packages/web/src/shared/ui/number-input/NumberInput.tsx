import type * as React from "react";

import { cn } from "@/shared/utils/cn";

type NumberInputProps = Omit<React.ComponentProps<"input">, "type">;

function NumberInput({ className, onChange, ...props }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let value = input.value;

    value = value.replace(/\s/g, "").replace(/,/g, ".");
    value = value.replace(/[^0-9.]/g, "");

    const parts = value.split(".");
    if (parts.length > 2) {
      value = `${parts[0]}.${parts.slice(1).join("")}`;
    }

    input.value = value;
    onChange?.(e);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-control-placeholder selection:bg-primary selection:text-primary-foreground h-9 w-full min-w-0 rounded-md bg-control px-3 py-1 text-sm shadow-xs transition-[color,background-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium hover:bg-control-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:bg-control focus-visible:ring-2 focus-visible:ring-control-focus/30",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/35 dark:aria-invalid:ring-destructive/45",
        className
      )}
      onChange={handleChange}
    />
  );
}

export { NumberInput };
