"use client";

import { useQuery } from "@tanstack/react-query";

import { getAccounts, getArchivedAccounts } from "@/modules/accounts/account.service";
import { Select } from "@/shared/ui/select/select";
import { type SelectOption } from "@/shared/ui/select/types";
import { getAccountIcon } from "@/shared/utils/account-icons";

interface AccountFilterProps {
  workspaceId: string;
  selectedAccountIds: string[] | undefined;
  onAccountIdsChange: (accountIds: string[] | undefined) => void;
}

export function AccountFilter({ workspaceId, selectedAccountIds, onAccountIdsChange }: AccountFilterProps) {
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const { data: archivedAccountsData } = useQuery({
    queryKey: ["archivedAccounts", workspaceId],
    queryFn: () => getArchivedAccounts(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const activeAccounts = accountsData?.data || [];
  const archivedAccounts = archivedAccountsData?.data || [];

  const accountOptions: SelectOption[] = [
    ...(activeAccounts.length > 0 ? [{ value: "__group_active__" as string, label: "Активные" }] : []),
    ...activeAccounts.map((account) => ({
      value: account.id,
      label: account.name,
    })),
    ...(archivedAccounts.length > 0 ? [{ value: "__group_archived__" as string, label: "Архивированные" }] : []),
    ...archivedAccounts.map((account) => ({
      value: account.id,
      label: account.name,
    })),
  ];

  const renderAccountOption = ({ option, selected }: { option: SelectOption; selected: boolean }) => {
    if (option.value === "__group_active__" || option.value === "__group_archived__") {
      return (
        <div
          className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          onClick={(e) => e.stopPropagation()}
        >
          {option.label}
        </div>
      );
    }

    const account = [...activeAccounts, ...archivedAccounts].find((a) => a.id === option.value);
    if (!account) return null;

    const AccountIcon = getAccountIcon(account.icon);

    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <AccountIcon className="h-4 w-4 text-muted-foreground" style={{ color: account.color || undefined }} />
        <span className={selected ? "font-medium" : ""}>{account.name}</span>
      </div>
    );
  };

  return (
    <Select
      options={accountOptions}
      value={selectedAccountIds}
      onChange={(newValue) => {
        onAccountIdsChange(Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined);
      }}
      placeholder="Все счета"
      label="Счета"
      multiple
      allowClear
      renderOption={renderAccountOption}
    />
  );
}
