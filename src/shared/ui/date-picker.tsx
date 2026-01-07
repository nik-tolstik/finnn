"use client";

import { format } from "date-fns";
import type { Locale } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  align?: "start" | "center" | "end";
  locale?: Locale;
  captionLayout?: "dropdown" | "dropdown-months" | "dropdown-years";
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Выберите дату",
  disabled,
  className,
  align = "start",
  locale = ru,
  captionLayout,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(0, 0, 0, 0);
      onSelect?.(newDate);
      setOpen(false);
    } else {
      onSelect?.(undefined);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between text-left font-normal", !date && "text-muted-foreground", className)}
        >
          {date ? format(date, "dd.MM.yyyy", { locale }) : <span>{placeholder}</span>}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          disabled={disabled}
          locale={locale}
          initialFocus
          captionLayout={captionLayout || "dropdown"}
        />
      </PopoverContent>
    </Popover>
  );
}
