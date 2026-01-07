"use client";

import { CheckIcon, ChevronDownIcon, X } from "lucide-react";
import * as React from "react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

import { SelectDropdownProps } from "./types";

export function SelectDropdown<TValue extends string | number = string>(
  props: SelectDropdownProps<TValue>
) {
  const {
    options,
    value,
    onChange,
    placeholder,
    multiple,
    allowClear,
    valueLabel,
    disabled,
    renderOption,
  } = props;
  const [open, setOpen] = useState(false);
  const selectedValues: TValue[] = multiple
    ? Array.isArray(value)
      ? (value as TValue[])
      : []
    : value !== undefined
      ? [value as TValue]
      : [];
  const currentValue = multiple ? undefined : (value as TValue | undefined);

  const getDisplayLabel = () => {
    if (valueLabel !== undefined) {
      return valueLabel;
    }
    if (multiple) {
      if (selectedValues.length === 0) {
        return placeholder;
      }
      if (selectedValues.length === 1) {
        const option = options.find((opt) => opt.value === selectedValues[0]);
        return option?.label || placeholder;
      }
      return `Выбрано: ${selectedValues.length}`;
    } else {
      if (currentValue === undefined) {
        return placeholder;
      }
      const option = options.find((opt) => opt.value === currentValue);
      return option?.label || placeholder;
    }
  };

  const handleSelect = (optionValue: TValue) => {
    if (!onChange) return;
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      (onChange as (value: TValue[]) => void)(newValues);
    } else {
      (onChange as (value: TValue) => void)(optionValue);
      setOpen(false);
    }
  };

  const handleClear = () => {
    if (!onChange) return;
    if (multiple) {
      (onChange as (value: TValue[]) => void)([]);
    } else {
      (onChange as (value: TValue) => void)(undefined as any);
    }
  };

  const hasSelection = multiple
    ? selectedValues.length > 0
    : currentValue !== undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !hasSelection && "text-muted-foreground"
          )}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <div className="flex items-center gap-1 shrink-0">
            {allowClear && hasSelection && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClear();
                  }
                }}
                className="rounded-full opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              >
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-1"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="max-h-96 overflow-y-auto">
          {options.map((option) => {
            const selected = multiple
              ? selectedValues.includes(option.value)
              : currentValue === option.value;

            if (renderOption) {
              return (
                <div
                  key={option.value.toString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(option.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(option.value);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent focus:bg-accent focus:outline-none",
                    selected && "bg-accent"
                  )}
                >
                  {renderOption({ option, props, selected })}
                </div>
              );
            }

            return (
              <div
                key={option.value.toString()}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(option.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(option.value);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent focus:bg-accent focus:outline-none",
                  selected && "bg-accent"
                )}
              >
                {multiple && (
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => handleSelect(option.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                )}
                <span className="flex-1">{option.label}</span>
                {!multiple && selected && (
                  <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
