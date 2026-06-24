"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import { getCategories } from "@/modules/categories/category.api";
import { DeleteScheduledPaymentDialog } from "@/modules/scheduled-payments/components/DeleteScheduledPaymentDialog";
import { ScheduledPaymentActionsDialog } from "@/modules/scheduled-payments/components/ScheduledPaymentActionsDialog";
import { ScheduledPaymentForm } from "@/modules/scheduled-payments/components/ScheduledPaymentForm";
import { ScheduledPaymentList } from "@/modules/scheduled-payments/components/ScheduledPaymentList";
import {
  createScheduledPayment,
  deleteScheduledPayment,
  getScheduledPayments,
  markScheduledPaymentPaid,
  skipScheduledPayment,
  updateScheduledPayment,
} from "@/modules/scheduled-payments/scheduled-payment.api";
import type {
  MarkScheduledPaymentPaidInput,
  ScheduledPayment,
  ScheduledPaymentFormInput,
} from "@/modules/scheduled-payments/scheduled-payment.types";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  accountKeys,
  analyticsKeys,
  categoryKeys,
  scheduledPaymentKeys,
  transactionKeys,
  workspaceKeys,
} from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";

interface PaymentsContentProps {
  workspaceId: string;
}

const DIALOG_TRANSITION_DELAY_MS = 200;

type MaybeActionData<T> = T | { data?: T; error?: string; success?: boolean } | undefined;

function invalidatePaymentNeighbors(queryClient: ReturnType<typeof useQueryClient>, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: accountKeys.all(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: analyticsKeys.all(workspaceId) });
}

function getQueryData<T>(value: MaybeActionData<T>, fallback: T): T {
  if (value && typeof value === "object") {
    if ("data" in value) {
      return value.data ?? fallback;
    }

    if ("error" in value || "success" in value) {
      return fallback;
    }
  }

  return (value as T | undefined) ?? fallback;
}

export function PaymentsContent({ workspaceId }: PaymentsContentProps) {
  const queryClient = useQueryClient();
  const formDialog = useDialogState<ScheduledPayment | null>();
  const paidDialog = useDialogState<ScheduledPayment>();
  const deleteDialog = useDialogState<ScheduledPayment>();
  const actionsDialog = useDialogState<ScheduledPayment>();

  const paymentsQuery = useQuery({
    queryKey: scheduledPaymentKeys.list(workspaceId),
    queryFn: () => getScheduledPayments(workspaceId),
  });
  const accountsQuery = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
  });
  const workspaceQuery = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
  });

  const accounts = getQueryData(accountsQuery.data, []);
  const categories = getQueryData(categoriesQuery.data, []).filter((category) => category.type === "expense");
  const members = getQueryData(membersQuery.data, []);
  const workspace = getQueryData(workspaceQuery.data, null);

  const createMutation = useMutation({
    mutationFn: (input: ScheduledPaymentFormInput) => createScheduledPayment(workspaceId, input),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж создан");
      void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduledPaymentFormInput }) =>
      updateScheduledPayment(workspaceId, id, input),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж обновлён");
      void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
    },
  });

  const paidMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MarkScheduledPaymentPaidInput }) =>
      markScheduledPaymentPaid(workspaceId, id, input),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж отмечен оплаченным");
      invalidatePaymentNeighbors(queryClient, workspaceId);
    },
  });

  const actionMutation = useMutation({
    mutationFn: (payment: ScheduledPayment) => skipScheduledPayment(workspaceId, payment.id),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж пропущен");
      void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (payment: ScheduledPayment) => deleteScheduledPayment(workspaceId, payment.id),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Платёж удалён");
      void queryClient.invalidateQueries({ queryKey: scheduledPaymentKeys.all(workspaceId) });
    },
  });

  const handleActionEdit = () => {
    if (!actionsDialog.data) return;
    const payment = actionsDialog.data;
    actionsDialog.closeDialog();
    setTimeout(() => {
      formDialog.openDialog(payment);
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  const handleActionMarkPaid = () => {
    if (!actionsDialog.data) return;
    const payment = actionsDialog.data;
    actionsDialog.closeDialog();
    setTimeout(() => {
      paidDialog.openDialog(payment);
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  const handleActionSkip = () => {
    if (!actionsDialog.data) return;
    const payment = actionsDialog.data;
    actionsDialog.closeDialog();
    actionMutation.mutate(payment);
  };

  const handleActionDelete = () => {
    if (!actionsDialog.data) return;
    const payment = actionsDialog.data;
    actionsDialog.closeDialog();
    setTimeout(() => {
      deleteDialog.openDialog(payment);
    }, DIALOG_TRANSITION_DELAY_MS);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Платежи</h1>
        <Button className="hidden md:inline-flex" onClick={() => formDialog.openDialog(null)}>
          <Plus className="size-4" />
          Создать платёж
        </Button>
      </div>

      <ScheduledPaymentList
        isLoading={paymentsQuery.isLoading}
        payments={paymentsQuery.data?.data || []}
        onDelete={(payment) => deleteDialog.openDialog(payment)}
        onEdit={(payment) => formDialog.openDialog(payment)}
        onMarkPaid={(payment) => paidDialog.openDialog(payment)}
        onPaymentClick={(payment) => actionsDialog.openDialog(payment)}
        onSkip={(payment) => actionMutation.mutate(payment)}
      />

      {actionsDialog.mounted && actionsDialog.data && (
        <ScheduledPaymentActionsDialog
          payment={actionsDialog.data}
          open={actionsDialog.open}
          onCloseComplete={actionsDialog.unmountDialog}
          onOpenChange={actionsDialog.closeDialog}
          onDelete={handleActionDelete}
          onEdit={handleActionEdit}
          onMarkPaid={handleActionMarkPaid}
          onSkip={handleActionSkip}
        />
      )}

      {formDialog.mounted && (
        <ScheduledPaymentForm
          accounts={accounts}
          baseCurrency={workspace?.baseCurrency}
          categories={categories}
          initialPayment={formDialog.data}
          members={members}
          open={formDialog.open}
          workspaceId={workspaceId}
          onCloseComplete={formDialog.unmountDialog}
          onOpenChange={formDialog.closeDialog}
          onSubmit={async (input) => {
            if (!formDialog.data) {
              const result = await createMutation.mutateAsync(input);
              if ("error" in result) throw new Error(result.error);
              return;
            }
            const result = await updateMutation.mutateAsync({ id: formDialog.data.id, input });
            if ("error" in result) throw new Error(result.error);
          }}
        />
      )}

      {paidDialog.mounted && paidDialog.data && (
        <CreateTransactionDialog
          account={paidDialog.data.accountId ? { id: paidDialog.data.accountId } : undefined}
          defaultType={PaymentTransactionType.EXPENSE}
          initialAmount={paidDialog.data.amount || paidDialog.data.amountMin || undefined}
          initialCategoryId={paidDialog.data.categoryId ?? undefined}
          initialDescription={paidDialog.data.name}
          lockType
          open={paidDialog.open}
          workspaceId={workspaceId}
          onCloseComplete={paidDialog.unmountDialog}
          onOpenChange={paidDialog.closeDialog}
          onPaymentSubmit={async (input) => {
            if (!paidDialog.data) return;
            const result = await paidMutation.mutateAsync({
              id: paidDialog.data.id,
              input: {
                accountId: input.accountId,
                amount: input.amount,
                categoryId: input.categoryId,
                createTransaction: true,
                note: input.description || undefined,
                paidAt: input.date,
              },
            });
            if ("error" in result) throw new Error(result.error);
          }}
        />
      )}

      {deleteDialog.mounted && deleteDialog.data && (
        <DeleteScheduledPaymentDialog
          isDeleting={deleteMutation.isPending}
          open={deleteDialog.open}
          payment={deleteDialog.data}
          onCloseComplete={deleteDialog.unmountDialog}
          onOpenChange={deleteDialog.closeDialog}
          onConfirm={async () => {
            if (!deleteDialog.data) return;
            const result = await deleteMutation.mutateAsync(deleteDialog.data);
            if ("error" in result) throw new Error(result.error);
            deleteDialog.closeDialog();
          }}
        />
      )}
    </div>
  );
}
