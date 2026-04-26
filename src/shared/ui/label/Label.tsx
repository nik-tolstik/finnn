"use client";

import type * as React from "react";

import { cn } from "@/shared/utils/cn";

export type LabelProps = {
  required?: boolean;
} & React.LabelHTMLAttributes<HTMLLabelElement>;

function Label({ className, required, children, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: common component
    <label
      data-slot="label"
      className={cn(
        "flex items-center text-sm leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive text-xl leading-none ml-1">*</span>}
    </label>
  );
}

export { Label };
