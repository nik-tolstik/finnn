"use client";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover } from "@/shared/ui/popover";
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
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement={align === "center" ? "bottom" : `bottom-${align}`}
      className="w-auto overflow-hidden p-0"
      trigger={({ ref, ...triggerProps }) => (
        <Button
          ref={ref}
          type="button"
          variant="outline"
          className={cn("w-full justify-between text-left font-normal", !date && "text-muted-foreground", className)}
          {...triggerProps}
        >
          {date ? format(date, "dd.MM.yyyy", { locale }) : <span>{placeholder}</span>}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      )}
    >
      <Calendar
        mode="single"
        selected={date}
        onSelect={handleSelect}
        disabled={disabled}
        locale={locale}
        initialFocus
        captionLayout={captionLayout || "dropdown"}
      />
    </Popover>
  );
}
