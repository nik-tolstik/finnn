"use client";

import { subMonths, subWeeks, subYears } from "date-fns";
import { useState, useEffect } from "react";

import { Select } from "@/shared/ui/select/select";
import { type SelectOption } from "@/shared/ui/select/types";
import { DatePicker } from "@/shared/ui/date-picker";

export type DateRangePreset = "week" | "month" | "6months" | "year" | "custom";

interface DateRangeFilterProps {
  dateFrom: Date;
  dateTo: Date;
  onDateRangeChange: (dateFrom: Date, dateTo: Date) => void;
}

const presetOptions: SelectOption<DateRangePreset>[] = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "6months", label: "6 месяцев" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Произвольный период" },
];

export function DateRangeFilter({ dateFrom: _dateFrom, dateTo: _dateTo, onDateRangeChange }: DateRangeFilterProps) {
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  useEffect(() => {
    if (preset === "custom") {
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let from: Date;
    switch (preset) {
      case "week":
        from = subWeeks(today, 1);
        break;
      case "month":
        from = subMonths(today, 1);
        break;
      case "6months":
        from = subMonths(today, 6);
        break;
      case "year":
        from = subYears(today, 1);
        break;
      default:
        from = subMonths(today, 1);
    }

    from.setHours(0, 0, 0, 0);
    onDateRangeChange(from, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const handleCustomDateChange = () => {
    if (customDateFrom && customDateTo) {
      const from = new Date(customDateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(customDateTo);
      to.setHours(23, 59, 59, 999);
      onDateRangeChange(from, to);
    }
  };

  return (
    <div className="space-y-3">
      <Select<DateRangePreset>
        options={presetOptions}
        value={preset}
        onChange={(value) => {
          setPreset(value);
        }}
        placeholder="Выберите период"
        label="Период"
        multiple={false}
      />
      {preset === "custom" && (
        <div className="flex gap-2">
          <DatePicker
            date={customDateFrom}
            onSelect={(date) => {
              setCustomDateFrom(date);
              if (date && customDateTo) {
                handleCustomDateChange();
              }
            }}
            placeholder="От"
            className="flex-1"
          />
          <DatePicker
            date={customDateTo}
            onSelect={(date) => {
              setCustomDateTo(date);
              if (date && customDateFrom) {
                handleCustomDateChange();
              }
            }}
            placeholder="До"
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
}
