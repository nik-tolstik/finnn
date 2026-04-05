export function resolveViewerUserId(sessionUserId?: string | null, initialUserId?: string | null) {
  return sessionUserId ?? initialUserId ?? null;
}

export function getVisibleAccounts<T extends { ownerId: string | null }>(
  accounts: T[],
  viewerUserId: string | null | undefined,
  showAllAccounts: boolean
) {
  if (showAllAccounts || !viewerUserId) {
    return accounts;
  }

  return accounts.filter((account) => account.ownerId === viewerUserId);
}
