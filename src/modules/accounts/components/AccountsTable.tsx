"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import type { Account } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Archive, Pencil } from "lucide-react";
import { useState } from "react";
import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

interface AccountsTableProps {
  accounts: Account[];
}

const accountTypeLabels: Record<string, string> = {
  cash: "Наличные",
  bank: "Банковский счёт",
  card: "Банковская карта",
  investment: "Инвестиционный счёт",
  other: "Другое",
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

function formatBalance(balance: string, currency: string): string {
  const num = parseFloat(balance);
  const symbol = currencySymbols[currency] || currency;
  return `${num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет счетов. Создайте первый счёт, чтобы начать.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Валюта</TableHead>
            <TableHead className="text-right">Баланс</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Дата создания</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell>
                {accountTypeLabels[account.type] || account.type}
              </TableCell>
              <TableCell>{account.currency}</TableCell>
              <TableCell className="text-right">
                {formatBalance(account.balance, account.currency)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {account.description || "-"}
              </TableCell>
              <TableCell>
                {format(new Date(account.createdAt), "dd.MM.yyyy", {
                  locale: ru,
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAccountToEdit(account);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAccount(account);
                      setArchiveDialogOpen(true);
                    }}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedAccount && (
        <ArchiveAccountDialog
          account={selectedAccount}
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
        />
      )}

      {accountToEdit && (
        <EditAccountDialog
          account={accountToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </>
  );
}

