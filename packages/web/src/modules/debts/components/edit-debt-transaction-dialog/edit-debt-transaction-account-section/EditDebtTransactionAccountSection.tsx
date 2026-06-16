"use client";

import { Controller, useFormContext } from "react-hook-form";

import { AccountSelector } from "@/shared/components/AccountSelector";
import type { UpdateDebtTransactionInput } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";

import { DebtTransactionType, DebtType } from "../../../debt.constants";
import type { DebtTransactionWithRelations } from "../../../debt.types";
import type { EditDebtTransactionDialogAccount } from "../edit-debt-transaction-dialog.types";

interface EditDebtTransactionAccountSectionProps {
  debtTransaction: DebtTransactionWithRelations;
  workspaceId: string;
  selectedAccount?: EditDebtTransactionDialogAccount;
  previewAccount?: EditDebtTransactionDialogAccount;
  currentAccountUnavailable: boolean;
}

export function EditDebtTransactionAccountSection({
  debtTransaction,
  workspaceId,
  selectedAccount,
  previewAccount,
  currentAccountUnavailable,
}: EditDebtTransactionAccountSectionProps) {
  const { control, formState } = useFormContext<UpdateDebtTransactionInput>();

  if (debtTransaction.type === DebtTransactionType.ADDED) {
    return (
      <div className="space-y-2">
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <>
              <AccountSelector
                workspaceId={workspaceId}
                account={previewAccount || selectedAccount || null}
                onSelect={(account) => field.onChange(account.id)}
                label={debtTransaction.debt.type === DebtType.LENT ? "Счёт для списания" : "Счёт для зачисления"}
                error={formState.errors.accountId?.message}
              />
              {field.value ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange("")}>
                  Без счёта
                </Button>
              ) : null}
            </>
          )}
        />
        {currentAccountUnavailable ? (
          <p className="text-sm text-muted-foreground">
            Текущий счёт "{debtTransaction.account?.name}" недоступен для выбора. Выберите другой счёт или очистите
            поле.
          </p>
        ) : null}
      </div>
    );
  }

  if (debtTransaction.type !== DebtTransactionType.CLOSED) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Controller
        control={control}
        name="accountId"
        render={({ field }) => (
          <AccountSelector
            workspaceId={workspaceId}
            account={previewAccount || selectedAccount || null}
            onSelect={(account) => field.onChange(account.id)}
            label={debtTransaction.debt.type === DebtType.LENT ? "Счёт для зачисления" : "Счёт для списания"}
            required
            error={formState.errors.accountId?.message}
          />
        )}
      />
      {currentAccountUnavailable ? (
        <p className="text-sm text-muted-foreground">
          Текущий счёт "{debtTransaction.account?.name}" недоступен для выбора. Выберите другой счёт.
        </p>
      ) : null}
    </div>
  );
}
