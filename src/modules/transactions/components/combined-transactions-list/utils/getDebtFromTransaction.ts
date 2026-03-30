import type { DebtTransactionWithRelations, DebtWithRelations } from "@/modules/debts/debt.types";

export function getDebtFromTransaction(debtTransaction: DebtTransactionWithRelations): DebtWithRelations {
  return {
    ...debtTransaction.debt,
    account:
      debtTransaction.debt.accountId && debtTransaction.account
        ? {
            id: debtTransaction.account.id,
            name: debtTransaction.account.name,
            currency: debtTransaction.account.currency,
            color: debtTransaction.account.color,
            icon: debtTransaction.account.icon,
          }
        : null,
  };
}
