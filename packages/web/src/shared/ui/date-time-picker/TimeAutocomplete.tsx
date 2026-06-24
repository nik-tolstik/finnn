"use client";

import * as React from "react";

import { Input } from "@/shared/ui/input";
import { Popover } from "@/shared/ui/popover";
import type { SelectOption } from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";

import { normalizeTimeInput } from "./time-options";

interface TimeAutocompleteProps {
  options: SelectOption<string>[];
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onSelect: (value: string) => void;
}

function getInitialActiveIndex(options: SelectOption<string>[], value: string) {
  const normalizedValue = normalizeTimeInput(value);
  if (!normalizedValue) return 0;

  const matchingIndex = options.findIndex((option) => option.value === normalizedValue);
  return matchingIndex >= 0 ? matchingIndex : 0;
}

export function TimeAutocomplete({ options, value, onBlur, onChange, onFocus, onSelect }: TimeAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(() => getInitialActiveIndex(options, value));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
  const activeOptionId = open ? `${listboxId}-option-${activeIndex}` : undefined;

  React.useEffect(() => {
    if (open) {
      setActiveIndex(getInitialActiveIndex(options, value));
    }
  }, [open, options, value]);

  const selectOption = (optionValue: string) => {
    onSelect(optionValue);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption) {
        selectOption(activeOption.value);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      className="w-[var(--popover-trigger-width)] p-1"
      trigger={({ ref, onClick, ...triggerProps }) => {
        void onClick;

        return (
          <div ref={ref} {...triggerProps}>
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-expanded={open}
              placeholder="HH:mm"
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              onFocus={(event) => {
                setOpen(true);
                onFocus?.();
                event.currentTarget.select();
              }}
              onBlur={() => {
                setOpen(false);
                onBlur?.();
              }}
              onKeyDown={handleKeyDown}
              className="h-9 w-[88px] py-0 px-2 text-sm"
            />
          </div>
        );
      }}
    >
      <div id={listboxId} role="listbox" className="max-h-60 overflow-y-auto">
        {options.map((option, index) => {
          const active = index === activeIndex;

          return (
            <button
              id={`${listboxId}-option-${index}`}
              key={option.value}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                active && "bg-accent"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
