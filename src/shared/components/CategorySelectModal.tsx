"use client";

import { Check, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { ComboboxOption } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

interface CategorySelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ComboboxOption[];
  value?: string;
  onSelect: (option: ComboboxOption) => void;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  createText?: string;
}

export function CategorySelectModal({
  open,
  onOpenChange,
  options,
  value,
  onSelect,
  onSearchChange,
  placeholder = "Выберите категорию",
  searchPlaceholder = "Поиск категории...",
  emptyText = "Категории не найдены",
  createText = "Создать",
}: CategorySelectModalProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.value.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    onSearchChange?.(newSearch);
  };

  const handleSelect = (option: ComboboxOption) => {
    onSelect(option);
    onOpenChange(false);
    setSearch("");
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Выберите категорию</DialogTitle>
          <DialogDescription>
            Выберите существующую категорию или создайте новую
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
                    value === option.value && "bg-accent"
                  )}
                >
                  {option.color && (
                    <div
                      className="h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="flex-1 text-sm">
                    {option.isTemporary ? (
                      <span className="flex items-center gap-2">
                        <Plus className="h-3 w-3" />
                        <span>
                          {createText}: {option.label}
                        </span>
                      </span>
                    ) : (
                      option.label
                    )}
                  </span>
                  {value === option.value && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
