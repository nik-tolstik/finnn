"use client";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { SelectDropdown } from "@/shared/ui/select/select-dropdown";
import { SelectSheet } from "@/shared/ui/select/select-sheet";

import { SelectProps } from "./types";

export function Select<TValue extends string | number = string>(props: SelectProps<TValue>) {
  const { isMobile } = useBreakpoints();

  return isMobile ? <SelectSheet {...props} /> : <SelectDropdown {...props} />;
}
