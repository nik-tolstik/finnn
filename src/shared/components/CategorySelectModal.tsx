"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { ComboboxOption } from "@/shared/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
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
}

export function CategorySelectModal({
  open,
  onOpenChange,
  options,
  value,
  onSelect,
  onSearchChange,
  placeholder: _placeholder = "Выберите категорию",
  searchPlaceholder = "Поиск категории...",
  emptyText = "Категории не найдены",
}: CategorySelectModalProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(searchLower) || opt.value.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    onSearchChange?.(newSearch);
  };

  const handleSelect = (option: ComboboxOption) => {
    onSelect(option);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Выберите категорию</DialogTitle>
          <DialogDescription>Выберите существующую категорию</DialogDescription>
        </DialogHeader>
        <DialogContent className="overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="overflow-y-auto space-y-1 mt-4 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
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
                  <span className="flex-1 text-sm">{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
