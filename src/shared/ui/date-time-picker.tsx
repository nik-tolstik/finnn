"use client";

import { format } from "date-fns";
import type { Locale } from "date-fns";
import { ru } from "date-fns/locale";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface DateTimePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  align?: "start" | "center" | "end";
  locale?: Locale;
  captionLayout?: "dropdown" | "dropdown-months" | "dropdown-years";
  showTime?: boolean;
}

export function DateTimePicker({
  date,
  onSelect,
  placeholder = "Выберите дату",
  disabled,
  className,
  align = "start",
  locale = ru,
  captionLayout,
  showTime = true,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState(() => {
    if (date) {
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return "00:00";
  });
  const [isTimeInputFocused, setIsTimeInputFocused] = React.useState(false);

  React.useEffect(() => {
    // Update timeValue only when the time field is not focused to avoid overwriting user input
    if (date && !isTimeInputFocused) {
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      setTimeValue(`${hours}:${minutes}`);
    }
  }, [date, isTimeInputFocused]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      // Use the input time when valid, otherwise use the current date time or 00:00
      if (timeValue.match(/^\d{2}:\d{2}$/)) {
        const [hours, minutes] = timeValue.split(":").map(Number);
        newDate.setHours(hours, minutes, 0, 0);
      } else if (date) {
        // Use the time from the current date
        newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
      } else {
        newDate.setHours(0, 0, 0, 0);
      }
      onSelect?.(newDate);
      setOpen(false);
    } else {
      onSelect?.(undefined);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTimeValue(value);
    // Update the date only when the time is fully entered (HH:mm format)
    if (date && value.match(/^\d{2}:\d{2}$/)) {
      const [hours, minutes] = value.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      onSelect?.(newDate);
    }
  };

  const handleTimeFocus = () => {
    setIsTimeInputFocused(true);
  };

  const handleTimeBlur = () => {
    setIsTimeInputFocused(false);
    // Validate and correct the time when the field loses focus
    if (!timeValue.match(/^\d{2}:\d{2}$/)) {
      const hours = date?.getHours() || 0;
      const minutes = date?.getMinutes() || 0;
      const correctedValue = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      setTimeValue(correctedValue);
    } else if (date) {
      // Ensure the date is synchronized with the entered time
      const [hours, minutes] = timeValue.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      onSelect?.(newDate);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between text-left font-normal border-input w-fit px-2",
              !date && "text-muted-foreground"
            )}
          >
            {date ? format(date, "dd.MM.yyyy", { locale }) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            disabled={disabled}
            locale={locale}
            initialFocus
            captionLayout={captionLayout || "dropdown"}
          />
        </PopoverContent>
      </Popover>
      {showTime && (
        <Input
          id="time"
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          onFocus={handleTimeFocus}
          onBlur={handleTimeBlur}
          className="h-9 w-fit py-0 px-2 text-sm"
        />
      )}
    </div>
  );
}
