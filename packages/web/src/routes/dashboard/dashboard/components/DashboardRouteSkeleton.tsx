import { AccountCardSkeleton } from "@/shared/components/AccountCardSkeleton";
import { Skeleton } from "@/shared/ui/skeleton";

export function DashboardRouteSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка счетов" className="mx-auto w-full max-w-[1024px]" role="status">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-semibold">Ваши счета</h2>
          <Skeleton className="h-5 w-7 rounded-full" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton className="hidden lg:flex" />
      </div>
    </div>
  );
}
