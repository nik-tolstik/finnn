import type { QueryClient } from "@tanstack/react-query";

import { accountKeys, categoryKeys, debtKeys, transactionKeys, workspaceKeys, workspacesKeys } from "./query-keys";

type WorkspaceDomain =
  | "workspaces"
  | "workspaceSummary"
  | "workspaceMembers"
  | "accounts"
  | "archivedAccounts"
  | "categories"
  | "transactions"
  | "debts";

export async function invalidateWorkspaceDomains(
  queryClient: QueryClient,
  workspaceId: string,
  domains: WorkspaceDomain[]
) {
  const domainSet = new Set(domains);

  const invalidations: Promise<unknown>[] = [];

  if (domainSet.has("workspaces")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: workspacesKeys.list() }));
  }

  if (domainSet.has("workspaceSummary")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: workspaceKeys.summary(workspaceId) }));
  }

  if (domainSet.has("workspaceMembers")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }));
  }

  if (domainSet.has("accounts")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: accountKeys.all(workspaceId) }));
  }

  if (domainSet.has("archivedAccounts")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: accountKeys.archived(workspaceId) }));
  }

  if (domainSet.has("categories")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: categoryKeys.all(workspaceId) }));
  }

  if (domainSet.has("transactions")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: transactionKeys.all(workspaceId) }));
  }

  if (domainSet.has("debts")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: debtKeys.all(workspaceId) }));
  }

  await Promise.all(invalidations);
}
