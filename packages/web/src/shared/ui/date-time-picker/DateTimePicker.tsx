"use client";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover } from "@/shared/ui/popover";
import { Segmented } from "@/shared/ui/segmented";
import { cn } from "@/shared/utils/cn";

import { TimeAutocomplete } from "./TimeAutocomplete";
import { applyTimeValue, createTimeOptions, formatTimeValue, normalizeTimeInput } from "./time-options";

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
  showDate?: boolean;
  showRelativeDatePresets?: boolean;
  timeStepMinutes?: number;
}

const relativeDatePresets = [
  { label: "Сегодня", daysAgo: 0 },
  { label: "Вчера", daysAgo: 1 },
  { label: "Позавчера", daysAgo: 2 },
];

function isSameCalendarDay(left: Date | undefined, right: Date) {
  return (
    left?.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
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
  showDate = true,
  showRelativeDatePresets = false,
  timeStepMinutes = 15,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState(() => (date ? formatTimeValue(date) : "00:00"));
  const [isTimeInputFocused, setIsTimeInputFocused] = React.useState(false);
  const timeOptions = React.useMemo(() => createTimeOptions(timeStepMinutes), [timeStepMinutes]);

  React.useEffect(() => {
    if (date && !isTimeInputFocused) {
      setTimeValue(formatTimeValue(date));
    }
  }, [date, isTimeInputFocused]);

  const applyCurrentTimeToDate = (targetDate: Date) => {
    return applyTimeValue(targetDate, timeValue) ?? applyTimeValue(targetDate, date ? formatTimeValue(date) : "00:00");
  };

  const applyTimeToCurrentDate = (value: string) => {
    const targetDate = date ? new Date(date) : new Date();
    const nextDate = applyTimeValue(targetDate, value);
    if (nextDate) {
      onSelect?.(nextDate);
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const nextDate = applyCurrentTimeToDate(selectedDate);
      onSelect?.(nextDate);
      setOpen(false);
    } else {
      onSelect?.(undefined);
    }
  };

  const handleRelativePresetSelect = (daysAgo: number) => {
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() - daysAgo);
    onSelect?.(applyCurrentTimeToDate(selectedDate));
    setOpen(false);
  };

  const getRelativePresetDate = (daysAgo: number) => {
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() - daysAgo);
    return selectedDate;
  };

  const selectedRelativePreset =
    relativeDatePresets.find((preset) => isSameCalendarDay(date, getRelativePresetDate(preset.daysAgo)))?.daysAgo ?? -1;

  const handleTimeValueChange = (value: string) => {
    setTimeValue(value);

    const normalizedTime = normalizeTimeInput(value);
    if (normalizedTime && (date || !showDate)) {
      applyTimeToCurrentDate(normalizedTime);
    }
  };

  const handleTimeSelect = (value: string) => {
    setTimeValue(value);
    if (date || !showDate) {
      applyTimeToCurrentDate(value);
    }
  };

  const handleTimeFocus = () => {
    setIsTimeInputFocused(true);
  };

  const handleTimeBlur = () => {
    setIsTimeInputFocused(false);
    const normalizedTime = normalizeTimeInput(timeValue);

    if (!normalizedTime) {
      setTimeValue(date ? formatTimeValue(date) : "00:00");
      return;
    }

    setTimeValue(normalizedTime);
    if (date || !showDate) {
      applyTimeToCurrentDate(normalizedTime);
    }
  };

  return (
    <div className={cn(showRelativeDatePresets ? "space-y-2" : "flex items-center gap-2", className)}>
      {showDate && showRelativeDatePresets && (
        <Segmented
          options={relativeDatePresets.map((preset) => ({
            value: preset.daysAgo,
            label: preset.label,
            disabled: disabled?.(getRelativePresetDate(preset.daysAgo)),
          }))}
          value={selectedRelativePreset}
          onChange={handleRelativePresetSelect}
          className="rounded-lg p-0.5 pb-1 [&_label]:min-h-7 [&_label]:rounded-md [&_label]:px-2"
        />
      )}
      <div className="flex items-center gap-2">
        {showDate && (
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
                className={cn(
                  "justify-between text-left font-normal border-input w-fit px-2",
                  !date && "text-muted-foreground"
                )}
                {...triggerProps}
              >
                {date ? format(date, "dd.MM.yyyy", { locale }) : <span>{placeholder}</span>}
              </Button>
            )}
          >
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={handleDateSelect}
              disabled={disabled}
              locale={locale}
              initialFocus
              captionLayout={captionLayout || "dropdown"}
            />
          </Popover>
        )}
        {showTime && (
          <TimeAutocomplete
            options={timeOptions}
            value={timeValue}
            onChange={handleTimeValueChange}
            onFocus={handleTimeFocus}
            onSelect={handleTimeSelect}
            onBlur={handleTimeBlur}
          />
        )}
      </div>
    </div>
  );
}
