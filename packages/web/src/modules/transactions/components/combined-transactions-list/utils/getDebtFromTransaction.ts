import type { DebtTransactionWithRelations, DebtWithRelations } from "@/modules/debts/debt.types";

export function getDebtFromTransaction(debtTransaction: DebtTransactionWithRelations): DebtWithRelations {
  return debtTransaction.debt;
}
