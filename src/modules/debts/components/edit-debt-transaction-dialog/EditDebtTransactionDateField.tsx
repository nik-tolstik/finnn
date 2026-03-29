"use client";

import { Controller, useFormContext } from "react-hook-form";

import type { UpdateDebtTransactionInput } from "@/shared/lib/validations/debt";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Label } from "@/shared/ui/label";

export function EditDebtTransactionDateField() {
  const { control } = useFormContext<UpdateDebtTransactionInput>();

  return (
    <div className="space-y-2">
      <Label>Дата</Label>
      <Controller
        control={control}
        name="date"
        render={({ field }) => <DateTimePicker date={field.value} onSelect={field.onChange} />}
      />
    </div>
  );
}
