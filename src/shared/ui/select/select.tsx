"use client";

import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { SelectDropdown } from "@/shared/ui/select/select-dropdown";
import { SelectSheet } from "@/shared/ui/select/select-sheet";

import { SelectProps } from "./types";

export function Select<TValue extends string | number = string>(
  props: SelectProps<TValue>
) {
  const isMobile = useIsMobile();

  return useIsMobile() ? (
    <SelectSheet {...props} />
  ) : (
    <SelectDropdown {...props} />
  );
}
