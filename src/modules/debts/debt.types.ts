import type { Debt, Account } from "@prisma/client";

export interface DebtWithRelations extends Debt {
  account: Pick<Account, "id" | "name" | "currency" | "color" | "icon"> | null;
}
