"use client";

import { ChevronDown, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

interface SelectTriggerButtonProps extends React.ComponentProps<typeof Button> {
  value?: string;
  placeholder?: string;
  onClear?: () => void;
  showClearButton?: boolean;
}

export const SelectTriggerButton = React.forwardRef<HTMLButtonElement, SelectTriggerButtonProps>(
  ({ value, placeholder = "Выберите...", onClear, showClearButton = false, children, className, ...props }, ref) => {
    return (
      <div className="relative">
        <Button
          ref={ref}
          type="button"
          variant="outline"
          className={cn("w-full justify-start", className)}
          {...props}
        >
          {value ? (
            <span className="truncate flex items-center gap-2 flex-1 min-w-0 text-left">{children}</span>
          ) : (
            <span className="text-muted-foreground text-left">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
        </Button>
        {showClearButton && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

SelectTriggerButton.displayName = "SelectTriggerButton";
