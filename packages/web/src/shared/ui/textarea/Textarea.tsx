"use client";

import type * as React from "react";
import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";

import { cn } from "@/shared/utils/cn";

const DEFAULT_ROWS = 3;
const MAX_ROWS = 5;

const Textarea = forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(
  ({ className, defaultValue, onInput, rows = DEFAULT_ROWS, value, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const minRows = Math.min(Math.max(rows, 1), MAX_ROWS);

    const resizeTextarea = useCallback(() => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      textarea.style.height = "auto";

      const computedStyle = window.getComputedStyle(textarea);
      const fontSize = Number.parseFloat(computedStyle.fontSize);
      const lineHeight = Number.parseFloat(computedStyle.lineHeight) || fontSize * 1.5;

      if (!Number.isFinite(lineHeight)) {
        return;
      }

      const verticalPadding =
        Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom);
      const verticalBorder =
        Number.parseFloat(computedStyle.borderTopWidth) + Number.parseFloat(computedStyle.borderBottomWidth);
      const minHeight = lineHeight * minRows + verticalPadding + verticalBorder;
      const maxHeight = lineHeight * MAX_ROWS + verticalPadding + verticalBorder;
      const contentHeight = Math.max(textarea.scrollHeight, minHeight);

      textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    }, [minRows]);

    const setTextareaRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    useLayoutEffect(() => {
      resizeTextarea();
    });

    useLayoutEffect(() => {
      window.addEventListener("resize", resizeTextarea);

      return () => {
        window.removeEventListener("resize", resizeTextarea);
      };
    }, [resizeTextarea]);

    return (
      <textarea
        ref={setTextareaRef}
        rows={minRows}
        data-slot="textarea"
        className={cn(
          "file:text-foreground placeholder:text-control-placeholder selection:bg-primary selection:text-primary-foreground flex min-h-[60px] w-full resize-none overflow-y-auto rounded-md bg-control px-3 py-2 text-sm transition-[color,background-color,box-shadow] outline-none hover:bg-control-hover disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "ring-inset focus-visible:bg-control focus-visible:ring-2 focus-visible:ring-control-focus/30",
          "aria-invalid:ring-2 aria-invalid:ring-destructive/35 dark:aria-invalid:ring-destructive/45",
          className
        )}
        onInput={(event) => {
          resizeTextarea();
          onInput?.(event);
        }}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    );
  }
);

export { Textarea };
