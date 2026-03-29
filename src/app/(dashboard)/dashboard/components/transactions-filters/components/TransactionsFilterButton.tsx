"use client";

import { Filter } from "lucide-react";

import { Button } from "@/shared/ui/button";

interface TransactionsFilterButtonProps {
  appliedFiltersCount: number;
  disabled?: boolean;
  onClick: () => void;
}

export function TransactionsFilterButton({
  appliedFiltersCount,
  disabled = false,
  onClick,
}: TransactionsFilterButtonProps) {
  return (
    <Button variant="outline" size="sm" className="gap-2" disabled={disabled} onClick={onClick}>
      <Filter className="h-4 w-4" />
      <span className="hidden md:inline">Фильтр</span>
      {appliedFiltersCount > 0 && (
        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {appliedFiltersCount}
        </span>
      )}
    </Button>
  );
}
