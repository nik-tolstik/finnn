import type * as React from "react";

import { cn } from "@/shared/utils/cn";

type InputProps = React.ComponentProps<"input"> & {
  prefix?: React.ReactNode;
};

function Input({ className, prefix, type, ...props }: InputProps) {
  return (
    <div className="relative w-full">
      {prefix && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex select-none items-center text-xs font-medium text-muted-foreground"
        >
          {prefix}
        </span>
      )}
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-control-placeholder selection:bg-primary selection:text-primary-foreground h-9 w-full min-w-0 rounded-md bg-control px-3 py-1 text-sm transition-[color,background-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium hover:bg-control-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "ring-inset focus-visible:bg-control focus-visible:ring-2 focus-visible:ring-control-focus/30",
          "aria-invalid:ring-2 aria-invalid:ring-destructive/35 dark:aria-invalid:ring-destructive/45",
          prefix && "pl-12",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Input };
