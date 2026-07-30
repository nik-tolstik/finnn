import { useBreakpoints } from "@/shared/hooks/useBreakpoints";

import { SelectDropdown } from "./SelectDropdown";
import { SelectSheet } from "./SelectSheet";
import type { SelectProps } from "./types";

export function Select<TValue extends string | number = string>(props: SelectProps<TValue>) {
  const { isMobile } = useBreakpoints();

  return isMobile ? <SelectSheet {...props} /> : <SelectDropdown {...props} />;
}
