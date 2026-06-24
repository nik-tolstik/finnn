import { z } from "zod";

import { normalizeMoneyString } from "@/shared/utils/money";

const POSITIVE_MONEY_MESSAGE = "Сумма должна быть больше 0";

function isPositiveMoneyString(value: string) {
  const num = parseFloat(value);
  return !Number.isNaN(num) && num > 0;
}

export function requiredPositiveMoneyString(requiredMessage: string) {
  return z
    .string()
    .min(1, requiredMessage)
    .overwrite(normalizeMoneyString)
    .refine(isPositiveMoneyString, { message: POSITIVE_MONEY_MESSAGE });
}

export function optionalPositiveMoneyString() {
  return z
    .string()
    .overwrite((value) => normalizeMoneyString(value) || value)
    .optional()
    .refine((value) => !value || isPositiveMoneyString(value), {
      message: POSITIVE_MONEY_MESSAGE,
    });
}
