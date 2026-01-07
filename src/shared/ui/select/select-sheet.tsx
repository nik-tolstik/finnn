"use client";

import { Check, Search } from "lucide-react";
import * as React from "react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { SelectTriggerButton } from "@/shared/ui/select/select-trigger-button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

import { SelectOption, SelectProps } from "./types";

export function SelectSheet<TValue extends string | number = string>(props: SelectProps<TValue>) {
  const { options, value, onChange, filter, multiple, allowClear, valueLabel, renderOption, placeholder, label } =
    props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const currentValues = multiple ? (Array.isArray(value) ? value : []) : typeof value === "string" ? [value] : [];
  const currentValue = multiple ? undefined : typeof value === "string" ? value : undefined;

  const [localValues, setLocalValues] = useState<TValue[]>(currentValues as TValue[]);

  React.useEffect(() => {
    if (open) {
      const newValues = multiple ? (Array.isArray(value) ? value : []) : value !== undefined ? [value] : [];
      setLocalValues(newValues as TValue[]);
      setSearch("");
    }
  }, [open, value, multiple]);

  const filteredOptions = (() => {
    if (filter) {
      return filter(search) ?? [];
    }

    if (!search) return options;

    const searchLower = search.toLowerCase();
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(searchLower) || String(opt.value).toLowerCase().includes(searchLower)
    );
  })();

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
  };

  const handleSelect = (option: SelectOption<TValue>) => {
    if (multiple) {
      setLocalValues((prev) => {
        if (prev.includes(option.value)) {
          return prev.filter((v) => v !== option.value);
        }
        return [...prev, option.value];
      });
    } else {
      if (onChange && !multiple) {
        (onChange as (value: TValue) => void)(option.value);
      }
      setOpen(false);
      setSearch("");
    }
  };

  const handleApply = () => {
    if (multiple && onChange) {
      (onChange as (value: TValue[]) => void)(localValues);
    }
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    if (multiple) {
      setLocalValues([]);
      if (onChange) {
        (onChange as (value: TValue[]) => void)([]);
      }
      setOpen(false);
      setSearch("");
    } else {
      if (onChange) {
        (onChange as (value: TValue) => void)(undefined as any);
      }
      setOpen(false);
      setSearch("");
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (multiple) {
        const resetValues = Array.isArray(value) ? value : [];
        setLocalValues(resetValues as TValue[]);
      }
      setSearch("");
    }
    setOpen(isOpen);
  };

  const selectedValues = multiple ? localValues : [];
  const hasSelection = multiple ? currentValues.length > 0 : currentValue !== undefined;

  const getSelectedLabel = () => {
    if (valueLabel !== undefined) {
      return valueLabel;
    }

    if (multiple) {
      if (currentValues.length === 0) {
        return placeholder;
      }
      if (currentValues.length === 1) {
        const option = options.find((opt) => opt.value === currentValues[0]);
        return option?.label || placeholder;
      }
      return `Выбрано: ${currentValues.length}`;
    } else {
      if (currentValue === undefined) {
        return placeholder;
      }
      const option = options.find((opt) => opt.value === currentValue);
      return option?.label || placeholder;
    }
  };

  const selectedLabel = getSelectedLabel();

  return (
    <>
      <SelectTriggerButton
        onClick={() => setOpen(true)}
        placeholder={placeholder}
        value={hasSelection ? "selected" : undefined}
      >
        {selectedLabel}
      </SelectTriggerButton>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="max-h-[80vh] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Найти"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</div>
              ) : (
                filteredOptions.map((option) => {
                  const selected = multiple
                    ? selectedValues.includes(option.value as TValue)
                    : currentValue === option.value;

                  if (renderOption) {
                    return (
                      <div
                        key={option.value}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelect(option)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(option);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent cursor-pointer focus:outline-none",
                          selected && "bg-accent"
                        )}
                      >
                        {renderOption({ option, props, selected })}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={option.value}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(option)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelect(option);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent cursor-pointer focus:outline-none",
                        selected && "bg-accent"
                      )}
                    >
                      {multiple && (
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => handleSelect(option)}
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <span className="flex-1 text-sm">
                        {option.isTemporary ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs">+</span>
                            <span>Создать: {option.label}</span>
                          </span>
                        ) : (
                          option.label
                        )}
                      </span>
                      {!multiple && selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {multiple && (
            <SheetFooter className="px-4 pb-4 pt-2 gap-2">
              {allowClear && hasSelection && (
                <Button variant="outline" onClick={handleClear} className="flex-1">
                  Очистить
                </Button>
              )}
              <Button onClick={handleApply} className={allowClear && hasSelection ? "flex-1" : "w-full"}>
                Применить
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
