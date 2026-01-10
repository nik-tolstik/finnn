"use client";

import { CheckIcon, ChevronDownIcon, X } from "lucide-react";
import * as React from "react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

import { SelectDropdownProps } from "./types";

export function SelectDropdown<TValue extends string | number = string>(props: SelectDropdownProps<TValue>) {
  const { options, value, onChange, placeholder, multiple, allowClear, valueLabel, disabled, renderOption } = props;
  const [open, setOpen] = useState(false);
  
  const selectedValues: TValue[] = React.useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? (value as TValue[]) : [];
    }
    return value !== undefined ? [value as TValue] : [];
  }, [value, multiple]);
  
  const currentValue = React.useMemo(() => {
    return multiple ? undefined : (value as TValue | undefined);
  }, [value, multiple]);

  const displayLabel = React.useMemo(() => {
    if (valueLabel !== undefined) {
      return valueLabel;
    }
    if (multiple) {
      const validSelectedValues = selectedValues.filter((v) => !String(v).startsWith("__group_"));
      if (validSelectedValues.length === 0) {
        return placeholder;
      }
      if (validSelectedValues.length === 1) {
        const option = options.find((opt) => opt.value === validSelectedValues[0]);
        if (!option) return placeholder;
        if (renderOption) {
          return renderOption({ option, props, selected: true, isTrigger: true });
        }
        return option.label;
      }
      return `Выбрано: ${validSelectedValues.length}`;
    } else {
      if (currentValue === undefined || String(currentValue).startsWith("__group_")) {
        return placeholder;
      }
      const option = options.find((opt) => opt.value === currentValue);
      if (!option) return placeholder;
      if (renderOption) {
        return renderOption({ option, props, selected: true, isTrigger: true });
      }
      return option.label;
    }
  }, [valueLabel, multiple, selectedValues, currentValue, options, renderOption, placeholder, props]);

  const handleSelect = (optionValue: TValue) => {
    if (!onChange) return;
    if (String(optionValue).startsWith("__group_")) return;
    
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

  const hasSelection = multiple ? selectedValues.length > 0 : currentValue !== undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start", !hasSelection && "text-muted-foreground")}
        >
          <span className={cn("truncate flex items-center gap-2 flex-1 min-w-0 text-left", renderOption && "flex-1 min-w-0")}>
            {displayLabel}
          </span>
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
      <PopoverContent className="p-1" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <div className="max-h-96 overflow-y-auto">
          {options.map((option) => {
            const selected = multiple ? selectedValues.includes(option.value) : currentValue === option.value;
            const isGroupHeader = String(option.value).startsWith("__group_");

            if (renderOption) {
              return (
                <div
                  key={option.value.toString()}
                  className={cn(
                    !isGroupHeader &&
                      "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent focus:bg-accent focus:outline-none",
                    !isGroupHeader && selected && "bg-accent"
                  )}
                  onClick={(e) => {
                    if (!isGroupHeader) {
                      const target = e.target as HTMLElement;
                      if (target.closest('button[data-radix-checkbox-root]')) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(option.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!isGroupHeader && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handleSelect(option.value);
                    }
                  }}
                >
                  {renderOption({ option, props, selected })}
                </div>
              );
            }
            return (
              <div
                key={option.value.toString()}
                className={cn(
                  !isGroupHeader &&
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent focus:bg-accent focus:outline-none",
                  !isGroupHeader && selected && "bg-accent"
                )}
              >
                {isGroupHeader ? (
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {option.label}
                  </div>
                ) : (
                  <>
                    {multiple ? (
                      <>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => handleSelect(option.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelect(option.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelect(option.value);
                            }
                          }}
                          className="flex-1"
                        >
                          {option.label}
                        </span>
                      </>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelect(option.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(option.value);
                          }
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <span className="flex-1">{option.label}</span>
                        {selected && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
