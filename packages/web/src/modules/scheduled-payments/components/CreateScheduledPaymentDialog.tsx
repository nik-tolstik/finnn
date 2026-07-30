import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import { getCategories } from "@/modules/categories/category.api";
import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { accountKeys, categoryKeys, scheduledPaymentKeys, workspaceKeys } from "@/shared/lib/query-keys";

import { createScheduledPayment } from "../scheduled-payment.api";
import type { ScheduledPaymentFormInitialValues, ScheduledPaymentFormInput } from "../scheduled-payment.types";
import { ScheduledPaymentForm } from "./ScheduledPaymentForm";

type MaybeActionData<T> = T | { data?: T; error?: string; success?: boolean } | undefined;

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

interface CreateScheduledPaymentDialogProps {
  workspaceId: string;
  initialValues?: ScheduledPaymentFormInitialValues;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CreateScheduledPaymentDialog({
  workspaceId,
  initialValues,
  open,
  onOpenChange,
  onCloseComplete,
}: CreateScheduledPaymentDialogProps) {
  const queryClient = useQueryClient();
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

  const accounts = useMemo(() => getQueryData(accountsQuery.data, []), [accountsQuery.data]);
  const categories = useMemo(
    () => getQueryData(categoriesQuery.data, []).filter((category) => category.type === "expense"),
    [categoriesQuery.data]
  );
  const members = useMemo(() => getQueryData(membersQuery.data, []), [membersQuery.data]);
  const workspace = getQueryData(workspaceQuery.data, null);
  const normalizedInitialValues = useMemo(() => {
    if (!initialValues) return undefined;

    const normalized: ScheduledPaymentFormInitialValues = { ...initialValues };

    if ("accountId" in initialValues) {
      normalized.accountId =
        initialValues.accountId && accounts.some((account) => account.id === initialValues.accountId)
          ? initialValues.accountId
          : null;
    }

    if ("categoryId" in initialValues) {
      normalized.categoryId =
        initialValues.categoryId && categories.some((category) => category.id === initialValues.categoryId)
          ? initialValues.categoryId
          : null;
    }

    return normalized;
  }, [accounts, categories, initialValues]);
  const isReferenceDataPending =
    accountsQuery.isPending || categoriesQuery.isPending || membersQuery.isPending || workspaceQuery.isPending;

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

  if (isReferenceDataPending) {
    return null;
  }

  return (
    <ScheduledPaymentForm
      accounts={accounts}
      baseCurrency={workspace?.baseCurrency}
      categories={categories}
      initialPayment={null}
      initialValues={normalizedInitialValues}
      members={members}
      open={open}
      workspaceId={workspaceId}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      onSubmit={async (input) => {
        const result = await createMutation.mutateAsync(input);
        if ("error" in result) throw new Error(result.error);
      }}
    />
  );
}
