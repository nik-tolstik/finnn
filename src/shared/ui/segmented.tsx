"use client";

import { motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { cloneElement, useId, useRef } from "react";

import { cn } from "@/shared/utils/cn";

export interface SegmentedOption<TValue extends string | number = string> {
  value: TValue;
  label: React.ReactNode;
  icon?: React.ReactElement<any>;
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
  layout?: "fit" | "fill";
}

export function Segmented<TValue extends string | number = string>({
  options,
  value,
  onChange,
  className,
  disabled,
  layout = "fit",
}: SegmentedProps<TValue>) {
  const prefersReducedMotion = useReducedMotion();
  const indicatorId = useId();
  const groupName = `segmented-${indicatorId}`;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const selectOption = (index: number) => {
    const option = options[index];

    if (!option || disabled || option.value === value) {
      return;
    }

    option.onClick?.();
    onChange(option.value);
  };

  const focusOption = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const moveSelection = (index: number) => {
    if (!options.length) {
      return;
    }

    const nextIndex = (index + options.length) % options.length;
    selectOption(nextIndex);
    focusOption(nextIndex);
  };

  return (
    <div
      className={cn(
        "relative isolate min-w-0 max-w-full items-stretch gap-1 rounded-xl border border-border/80 bg-muted/75 p-1 shadow-xs",
        layout === "fill" ? "flex w-full" : "inline-flex w-fit",
        disabled && "opacity-60",
        className
      )}
      role="radiogroup"
      aria-disabled={disabled}
      aria-orientation="horizontal"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <label
            key={String(option.value)}
            data-state={isSelected ? "active" : "inactive"}
            className={cn(
              "relative inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
              layout === "fill" ? "min-h-9 flex-1" : "min-h-9 flex-none",
              disabled ? "cursor-default" : "cursor-pointer",
              isSelected
                ? cn("text-foreground", option.selectedClassName)
                : cn(
                    "text-muted-foreground hover:bg-background/55 hover:text-foreground dark:hover:bg-background/10",
                    option.className
                  )
            )}
          >
            <input
              ref={(node) => {
                inputRefs.current[index] = node;
              }}
              type="radio"
              name={groupName}
              checked={isSelected}
              onChange={() => selectOption(index)}
              onKeyDown={(event) => {
                if (disabled || !options.length) {
                  return;
                }

                switch (event.key) {
                  case "ArrowRight":
                  case "ArrowDown":
                    event.preventDefault();
                    moveSelection(activeIndex + 1);
                    break;
                  case "ArrowLeft":
                  case "ArrowUp":
                    event.preventDefault();
                    moveSelection(activeIndex - 1);
                    break;
                  case "Home":
                    event.preventDefault();
                    moveSelection(0);
                    break;
                  case "End":
                    event.preventDefault();
                    moveSelection(options.length - 1);
                    break;
                  default:
                    break;
                }
              }}
              disabled={disabled}
              tabIndex={disabled ? -1 : index === activeIndex ? 0 : -1}
              className="sr-only"
            />
            {isSelected ? (
              <motion.span
                layoutId={`segmented-indicator-${indicatorId}`}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
                }
                className="absolute inset-0 rounded-[10px] border border-border/80 bg-background shadow-sm"
              />
            ) : null}
            {option.icon && cloneElement(option.icon, { className: cn("z-10 size-3.5", option.icon.props.className) })}
            <span className="relative z-10 min-w-0 truncate">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
