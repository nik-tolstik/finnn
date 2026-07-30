export type ProtectedRouteKey = "analytics" | "dashboard" | "debts" | "payments";

type ProtectedRouteLoaders<T> = Record<ProtectedRouteKey, () => Promise<T>>;

function getProtectedRouteKey(pathname: string): ProtectedRouteKey | null {
  const [firstSegment] = pathname.split(/[/?#]/).filter(Boolean);

  if (
    firstSegment === "analytics" ||
    firstSegment === "dashboard" ||
    firstSegment === "debts" ||
    firstSegment === "payments"
  ) {
    return firstSegment;
  }

  return null;
}

export function preloadMatchedProtectedRoute<T>(
  pathname: string,
  loaders: ProtectedRouteLoaders<T>
): Promise<T> | null {
  const routeKey = getProtectedRouteKey(pathname);
  return routeKey ? loaders[routeKey]() : null;
}
