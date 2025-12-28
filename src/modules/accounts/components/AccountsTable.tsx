"use client";

import type { Account } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Archive, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

interface AccountsTableProps {
  accounts: Account[];
  workspaceId: string;
}

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

export function AccountsTable({
  accounts,
  workspaceId,
}: AccountsTableProps) {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [accountForTransaction, setAccountForTransaction] =
    useState<Account | null>(null);

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
            <TableHead>Валюта</TableHead>
            <TableHead className="text-right">Баланс</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Дата создания</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow
              key={account.id}
              className="cursor-pointer"
              onClick={() => router.push(`/accounts/${account.id}`)}
            >
              <TableCell className="font-medium">{account.name}</TableCell>
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
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAccountForTransaction(account);
                      setTransactionDialogOpen(true);
                    }}
                    title="Добавить транзакцию"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAccountToEdit(account);
                      setEditDialogOpen(true);
                    }}
                    title="Редактировать"
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
                    title="Архивировать"
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

      {accountForTransaction && (
        <CreateTransactionDialog
          account={accountForTransaction}
          workspaceId={workspaceId}
          open={transactionDialogOpen}
          onOpenChange={setTransactionDialogOpen}
        />
      )}
    </>
  );
}

