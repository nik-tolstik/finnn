"use client";

import { useLayoutEffect, useState } from "react";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";

import { SelectDropdown } from "./SelectDropdown";
import { SelectSheet } from "./SelectSheet";
import type { SelectProps } from "./types";

export function Select<TValue extends string | number = string>(props: SelectProps<TValue>) {
  const { isMobile } = useBreakpoints();
  const [hasMounted, setHasMounted] = useState(false);

  useLayoutEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <SelectDropdown {...props} />;
  }

  return isMobile ? <SelectSheet {...props} /> : <SelectDropdown {...props} />;
}
