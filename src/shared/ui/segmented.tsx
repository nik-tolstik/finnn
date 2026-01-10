"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

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

interface IndicatorState {
  width: number;
  left: number;
  transition: string | undefined;
}

export function Segmented<TValue extends string | number = string>({
  options,
  value,
  onChange,
  className,
  disabled,
}: SegmentedProps<TValue>) {
  const optionRefs = useRef<HTMLButtonElement[]>([]);
  const [indicator, setIndicator] = useState<IndicatorState | null>(null);
  const hasInitializedRef = useRef(false);

  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);

  const updateIndicator = useCallback(() => {
    const target = optionRefs.current[selectedIndex];
    if (!target) return;

    const { offsetWidth, offsetLeft } = target;

    let transition: string | undefined;

    if (hasInitializedRef.current) {
      transition = "all 200ms ease-out";
    }

    hasInitializedRef.current = true;
    setIndicator({ width: offsetWidth, left: offsetLeft, transition });
  }, [selectedIndex]);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      updateIndicator();
    });
  }, [updateIndicator, options]);

  useLayoutEffect(() => {
    window.addEventListener("resize", updateIndicator);

    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      className={cn(
        "relative inline-flex h-9 items-center justify-center rounded-lg bg-muted text-muted-foreground gap-1 border border-border overflow-hidden",
        className
      )}
      role="radiogroup"
    >
      <div
        className={cn(
          "absolute h-full top-1/2 left-0 -translate-y-1/2 rounded-md bg-background shadow-sm pointer-events-none",
          indicator?.transition && "transition-all duration-200 ease-in-out"
        )}
        style={
          indicator
            ? {
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
                transition: indicator.transition,
              }
            : undefined
        }
      />
      {options.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              if (disabled) return;
              option.onClick?.();
              onChange(option.value);
            }}
            ref={(node) => {
              if (node) optionRefs.current[index] = node;
            }}
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
