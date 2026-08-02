import type * as React from "react";

import { Input } from "@/shared/ui/input";

import { normalizeNumberInputValue } from "./number-input.utils";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  allowNegative?: boolean;
};

function NumberInput({ allowNegative = false, onChange, ...props }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    input.value = normalizeNumberInputValue(input.value, allowNegative);
    onChange?.(e);
  };

  return <Input {...props} type="text" inputMode="decimal" onChange={handleChange} />;
}

export { NumberInput };
