import type * as React from "react";

import { cn } from "@/shared/utils/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "file:text-foreground placeholder:text-control-placeholder selection:bg-primary selection:text-primary-foreground flex min-h-[60px] w-full rounded-md bg-control px-3 py-2 text-sm transition-[color,background-color,box-shadow] outline-none hover:bg-control-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "ring-inset focus-visible:bg-control focus-visible:ring-2 focus-visible:ring-control-focus/30",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/35 dark:aria-invalid:ring-destructive/45",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
