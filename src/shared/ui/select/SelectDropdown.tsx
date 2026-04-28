"use client";

import { CheckIcon } from "lucide-react";
import * as React from "react";
import { useState } from "react";

import { Popover } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

import { SelectTriggerButton } from "./SelectTriggerButton";
import type { SelectDropdownProps } from "./types";

export function SelectDropdown<TValue extends string | number = string>(props: SelectDropdownProps<TValue>) {
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
    popoverClassName,
  } = props;
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
    if (String(optionValue).startsWith("__group_")) {
      if (!multiple) return;

      const groupIndex = options.findIndex((opt) => opt.value === optionValue);
      if (groupIndex === -1) return;

      const groupAccounts: TValue[] = [];
      for (let i = groupIndex + 1; i < options.length; i++) {
        const opt = options[i];
        if (String(opt.value).startsWith("__group_")) {
          break;
        }
        groupAccounts.push(opt.value);
      }

      const allSelected = groupAccounts.every((accId) => selectedValues.includes(accId));
      const newValues = allSelected
        ? selectedValues.filter((v) => !groupAccounts.includes(v))
        : [...selectedValues.filter((v) => !groupAccounts.includes(v)), ...groupAccounts];

      (onChange as (value: TValue[]) => void)(newValues);
      return;
    }

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
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      className={cn("p-1", popoverClassName)}
      style={popoverClassName ? undefined : { width: "var(--popover-trigger-width)" }}
      trigger={({ ref, ...triggerProps }) => (
        <SelectTriggerButton
          ref={ref}
          type="button"
          value={hasSelection ? "selected" : undefined}
          disabled={disabled}
          onClear={allowClear && hasSelection ? handleClear : undefined}
          showClearButton={allowClear && hasSelection}
          className={cn("w-full justify-start", !hasSelection && "text-muted-foreground")}
          {...triggerProps}
        >
          <span
            className={cn(
              "truncate flex items-center gap-2 flex-1 min-w-0 text-left",
              renderOption && "flex-1 min-w-0"
            )}
          >
            {displayLabel}
          </span>
        </SelectTriggerButton>
      )}
    >
      <div className="max-h-96 overflow-y-auto flex flex-col gap-1">
        {options.map((option, index) => {
          const selected = multiple ? selectedValues.includes(option.value) : currentValue === option.value;
          const isGroupHeader = String(option.value).startsWith("__group_");

          let isInGroup = false;
          let hasPreviousGroup = false;

          if (!isGroupHeader) {
            for (let i = index - 1; i >= 0; i--) {
              const prevOption = options[i];
              if (String(prevOption.value).startsWith("__group_")) {
                isInGroup = true;
                break;
              }
            }
          } else {
            for (let i = index - 1; i >= 0; i--) {
              const prevOption = options[i];
              if (String(prevOption.value).startsWith("__group_")) {
                hasPreviousGroup = true;
                break;
              }
            }
          }

          if (renderOption) {
            if (isGroupHeader) {
              if (!multiple) {
                return (
                  <div
                    key={option.value.toString()}
                    className={cn(
                      "px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                      hasPreviousGroup && "mt-2"
                    )}
                  >
                    {renderOption({ option, props, selected })}
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={option.value.toString()}
                  onClick={() => {
                    handleSelect(option.value);
                  }}
                  className={cn(
                    "w-full rounded-sm px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent/50",
                    hasPreviousGroup && "mt-2"
                  )}
                >
                  {renderOption({ option, props, selected })}
                </button>
              );
            }

            return (
              <button
                type="button"
                key={option.value.toString()}
                onClick={() => {
                  handleSelect(option.value);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm py-2 px-2 text-sm text-left hover:bg-accent focus:bg-accent focus:outline-none",
                  isInGroup && "pl-4.5 pr-2",
                  selected && "bg-accent"
                )}
              >
                {renderOption({ option, props, selected })}
              </button>
            );
          }

          if (isGroupHeader) {
            return (
              <div
                key={option.value.toString()}
                className={cn("px-2 pt-2 pb-3 text-sm font-bold text-accent-foreground", hasPreviousGroup && "mt-2")}
              >
                {option.label}
              </div>
            );
          }

          return (
            <button
              type="button"
              key={option.value.toString()}
              onClick={() => {
                handleSelect(option.value);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm py-2 text-sm text-left hover:bg-accent focus:bg-accent focus:outline-none",
                isInGroup ? "px-4" : "px-2",
                selected && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="flex-1">{option.label}</span>
                {selected && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
