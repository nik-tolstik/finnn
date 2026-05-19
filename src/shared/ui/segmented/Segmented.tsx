"use client";

import { motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { cloneElement, useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

export interface SegmentedOption<TValue extends string | number = string> {
  value: TValue;
  label: React.ReactNode;
  icon?: React.ReactElement<any>;
  onClick?: () => void;
  className?: string;
  selectedClassName?: string;
  disabled?: boolean;
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
  const groupId = useId();
  const groupName = `segmented-${groupId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const optionRefs = useRef<Array<HTMLLabelElement | null>>([]);
  const [indicatorMetrics, setIndicatorMetrics] = useState({
    height: 0,
    left: 0,
    top: 0,
    width: 0,
  });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : Math.max(firstEnabledIndex, 0);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const selectedOption = selectedIndex >= 0 ? optionRefs.current[selectedIndex] : null;

    if (!container || !selectedOption) {
      setIndicatorMetrics({
        height: 0,
        left: 0,
        top: 0,
        width: 0,
      });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const optionRect = selectedOption.getBoundingClientRect();

    setIndicatorMetrics({
      height: optionRect.height,
      left: optionRect.left - containerRect.left,
      top: optionRect.top - containerRect.top,
      width: optionRect.width,
    });
  }, [selectedIndex]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const selectedOption = selectedIndex >= 0 ? optionRefs.current[selectedIndex] : null;

    if (!container || !selectedOption) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(container);
    resizeObserver.observe(selectedOption);
    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [selectedIndex, updateIndicator]);

  const selectOption = (index: number) => {
    const option = options[index];

    if (!option || disabled || option.disabled || option.value === value) {
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

    const normalizedIndex = (index + options.length) % options.length;
    const nextOffset = options.findIndex((_, optionIndex) => {
      const offsetIndex = (normalizedIndex + optionIndex) % options.length;
      return !options[offsetIndex]?.disabled;
    });
    const nextIndex = nextOffset >= 0 ? (normalizedIndex + nextOffset) % options.length : -1;

    if (nextIndex < 0) {
      return;
    }

    selectOption(nextIndex);
    focusOption(nextIndex);
  };

  return (
    <div
      ref={containerRef}
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
      {indicatorMetrics.width > 0 ? (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={indicatorMetrics}
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }
          }
          className="pointer-events-none absolute rounded-[10px] border border-border/80 bg-background shadow-sm"
        />
      ) : null}
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isOptionDisabled = disabled || option.disabled;

        return (
          <label
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            key={String(option.value)}
            data-state={isSelected ? "active" : "inactive"}
            className={cn(
              "relative inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
              layout === "fill" ? "min-h-9 flex-1" : "min-h-9 flex-none",
              isOptionDisabled ? "cursor-default opacity-60" : "cursor-pointer",
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
                if (isOptionDisabled || !options.length) {
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
              disabled={isOptionDisabled}
              tabIndex={isOptionDisabled ? -1 : index === activeIndex ? 0 : -1}
              className="sr-only"
            />
            {option.icon &&
              cloneElement(option.icon, { className: cn("relative z-10 size-3.5", option.icon.props.className) })}
            <span className="relative z-10 min-w-0 truncate">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
