"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { Debt, Account } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { CloseDebtDialog } from "./CloseDebtDialog";

interface DebtWithAccount extends Debt {
  account: Pick<Account, "id" | "name" | "currency">;
}

interface DebtsTableProps {
  debts: DebtWithAccount[];
  workspaceId: string;
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
  }>;
}

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  paid: "Погашен",
  cancelled: "Отменён",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  paid: "bg-green-500/10 text-green-500",
  cancelled: "bg-gray-500/10 text-gray-500",
};

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  RUB: "₽",
  BYN: "Br",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

function formatAmount(amount: string, currency: string): string {
  const num = parseFloat(amount);
  const symbol = currencySymbols[currency] || currency;
  return `${num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}

export function DebtsTable({
  debts,
  workspaceId,
  accounts,
}: DebtsTableProps) {
  const [selectedDebt, setSelectedDebt] = useState<DebtWithAccount | null>(
    null
  );
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  if (debts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет долгов. Создайте первый долг, чтобы начать.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Тип</TableHead>
            <TableHead>Имя</TableHead>
            <TableHead>Счёт</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead>Комментарий</TableHead>
            <TableHead>Дата возврата</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debts.map((debt) => (
            <TableRow key={debt.id}>
              <TableCell>
                <Badge variant={debt.type === "lent" ? "default" : "secondary"}>
                  {debt.type === "lent" ? "Одалживаю" : "Занимаю"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{debt.debtorName}</TableCell>
              <TableCell>{debt.account.name}</TableCell>
              <TableCell className="text-right">
                {formatAmount(debt.amount, debt.account.currency)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {debt.description || "-"}
              </TableCell>
              <TableCell>
                {debt.dueDate
                  ? format(new Date(debt.dueDate), "dd.MM.yyyy", { locale: ru })
                  : "-"}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[debt.status]}>
                  {statusLabels[debt.status]}
                </Badge>
              </TableCell>
              <TableCell>
                {debt.status === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDebt(debt);
                      setCloseDialogOpen(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Закрыть
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedDebt && (
        <CloseDebtDialog
          debt={selectedDebt}
          workspaceId={workspaceId}
          accounts={accounts}
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
        />
      )}
    </>
  );
}

