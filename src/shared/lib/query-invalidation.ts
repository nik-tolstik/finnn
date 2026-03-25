import type { QueryClient } from "@tanstack/react-query";

import { accountKeys, analyticsKeys, categoryKeys, debtKeys, transactionKeys, workspaceKeys, workspacesKeys } from "./query-keys";

type WorkspaceDomain =
  | "workspaces"
  | "workspaceSummary"
  | "workspaceMembers"
  | "accounts"
  | "archivedAccounts"
  | "categories"
  | "transactions"
  | "debts"
  | "capital"
  | "analytics"
  | "analyticsCategory"
  | "analyticsTotal";

export async function invalidateWorkspaceDomains(
  queryClient: QueryClient,
  workspaceId: string,
  domains: WorkspaceDomain[]
) {
  const domainSet = new Set(domains);

  if (domainSet.has("analytics")) {
    domainSet.add("analyticsCategory");
    domainSet.add("analyticsTotal");
  }

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

  if (domainSet.has("capital")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: analyticsKeys.capital(workspaceId) }));
  }

  if (domainSet.has("analyticsCategory")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: analyticsKeys.categoryPrefix(workspaceId) }));
  }

  if (domainSet.has("analyticsTotal")) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: analyticsKeys.totalPrefix(workspaceId) }));
  }

  await Promise.all(invalidations);
}
