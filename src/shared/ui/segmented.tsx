"use client";

import { cn } from "@/shared/utils/cn";

export interface SegmentedOption<TValue extends string | number = string> {
  value: TValue;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  selectedClassName?: string;
}

interface SegmentedProps<TValue extends string | number = string> {
  options: SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  className?: string;
  disabled?: boolean;
}

export function Segmented<TValue extends string | number = string>({
  options,
  value,
  onChange,
  className,
  disabled,
}: SegmentedProps<TValue>) {
  return (
    <div
      className={cn("grid h-9 w-full items-stretch gap-1 rounded-lg border border-border bg-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              if (disabled) return;
              option.onClick?.();
              onChange(option.value);
            }}
            disabled={disabled}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              isSelected
                ? cn("bg-background text-foreground shadow-sm", option.selectedClassName)
                : cn("text-muted-foreground hover:text-foreground", option.className)
            )}
          >
            {option.icon && <span className="h-4 w-4 shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
