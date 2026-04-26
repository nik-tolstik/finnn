"use client";

import { CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

type CheckboxSize = "sm" | "md" | "lg";

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"button">, "onChange" | "type" | "value"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: CheckboxSize;
};

const checkboxSizeClasses: Record<CheckboxSize, { root: string; icon: string }> = {
  sm: {
    root: "size-3.5 rounded-md",
    icon: "size-3",
  },
  md: {
    root: "size-4.5 rounded-md",
    icon: "size-3",
  },
  lg: {
    root: "size-5 rounded-md",
    icon: "size-3.5",
  },
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, defaultChecked = false, disabled, onCheckedChange, onClick, size = "md", ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const currentChecked = isControlled ? checked : internalChecked;
    const sizeClasses = checkboxSizeClasses[size];

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);

      if (event.defaultPrevented || disabled) {
        return;
      }

      const nextChecked = !currentChecked;

      if (!isControlled) {
        setInternalChecked(nextChecked);
      }

      onCheckedChange?.(nextChecked);
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        data-state={currentChecked ? "checked" : "unchecked"}
        data-size={size}
        className={cn(
          "peer inline-flex shrink-0 items-center justify-center border border-border transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          currentChecked ? "bg-primary text-primary-foreground" : "bg-transparent text-transparent",
          sizeClasses.root,
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <CheckIcon
          className={cn("transition-opacity", currentChecked ? "opacity-100" : "opacity-0", sizeClasses.icon)}
          strokeWidth={4}
        />
      </button>
    );
  }
);

Checkbox.displayName = "Checkbox";

export type { CheckboxProps, CheckboxSize };
export { Checkbox };
