"use client";

import type { Account } from "@prisma/client";
import { Archive, ArrowLeftRight, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { CreateTransferDialog } from "@/modules/transactions/components/CreateTransferDialog";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

interface AccountsCardsProps {
  accounts: Account[];
  workspaceId: string;
}

export function AccountsCards({ accounts, workspaceId }: AccountsCardsProps) {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [accountForTransaction, setAccountForTransaction] =
    useState<Account | null>(null);
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFromAccountId, setTransferFromAccountId] = useState<
    string | undefined
  >(undefined);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,300px)]">
        {accounts.map((account) => {
          const AccountIcon = getAccountIcon(account.icon);
          return (
            <Card
              key={account.id}
              className={cn(
                "group relative transition-all hover:shadow-md overflow-hidden",
                !account.color && "bg-card"
              )}
              style={
                account.color
                  ? {
                      background: `linear-gradient(to right, var(--card), ${account.color})`,
                    }
                  : undefined
              }
            >
              <CardHeader className="py-0 gap-0">
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <AccountIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold">
                        {account.name}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <p className="text-base font-bold">
                      {formatMoney(account.balance, account.currency)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <div
                className="absolute size-full left-0 top-0 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center bg-background/80"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
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
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setTransferFromAccountId(account.id);
                    setTransferDialogOpen(true);
                  }}
                  title="Создать перевод"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
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
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setSelectedAccount(account);
                    setArchiveDialogOpen(true);
                  }}
                  title="Архивировать"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
        <Card
          className={cn(
            "group relative transition-all hover:shadow-md cursor-pointer border-dashed hover:border-primary hover:bg-accent/50"
          )}
          onClick={() => setCreateAccountDialogOpen(true)}
        >
          <div className="flex items-center justify-center h-full w-full">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
        </Card>
      </div>

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
      <CreateAccountDialog
        workspaceId={workspaceId}
        open={createAccountDialogOpen}
        onOpenChange={setCreateAccountDialogOpen}
      />
      <CreateTransferDialog
        workspaceId={workspaceId}
        open={transferDialogOpen}
        onOpenChange={(open) => {
          setTransferDialogOpen(open);
          if (!open) {
            setTransferFromAccountId(undefined);
          }
        }}
        defaultFromAccountId={transferFromAccountId}
      />
    </>
  );
}
