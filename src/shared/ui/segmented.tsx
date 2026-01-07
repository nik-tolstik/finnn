"use client";

import * as React from "react";

import { cn } from "@/shared/utils/cn";

export interface SegmentedOption<TValue extends string | number = string> {
  value: TValue;
  label: React.ReactNode;
  icon?: React.ReactNode;
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const indicatorRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({});

  const selectedIndex = options.findIndex((option) => option.value === value);

  React.useEffect(() => {
    if (!containerRef.current || !indicatorRef.current || selectedIndex === -1) return;

    const container = containerRef.current;
    const buttons = container.querySelectorAll("button");
    const selectedButton = buttons[selectedIndex];

    if (selectedButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();

      setIndicatorStyle({
        left: `${buttonRect.left - containerRect.left}px`,
        width: `${buttonRect.width}px`,
      });
    }
  }, [selectedIndex, value]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground gap-1",
        className
      )}
      role="radiogroup"
    >
      <div
        ref={indicatorRef}
        className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm transition-all duration-200 ease-in-out pointer-events-none"
        style={indicatorStyle}
      />
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-foreground",
              isSelected ? option.selectedClassName : option.className
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
