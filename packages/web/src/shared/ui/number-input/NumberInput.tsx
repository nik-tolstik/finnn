import type * as React from "react";

import { Input } from "@/shared/ui/input";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

function NumberInput({ onChange, ...props }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let value = input.value;

    value = value.replace(/\s/g, "").replace(/,/g, ".");
    value = value.replace(/[^0-9.]/g, "");

    const parts = value.split(".");
    if (parts.length > 2) {
      value = `${parts[0]}.${parts.slice(1).join("")}`;
    }

    input.value = value;
    onChange?.(e);
  };

  return <Input {...props} type="text" inputMode="decimal" onChange={handleChange} />;
}

export { NumberInput };
