import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";

interface AccountCardSkeletonProps {
  className?: string;
}

export function AccountCardSkeleton({ className }: AccountCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-16 overflow-hidden rounded-xl bg-account-card text-card-foreground shadow-[var(--account-card-shadow)]",
        className
      )}
    >
      <div className="flex w-[52px] shrink-0 items-center justify-center bg-control">
        <Skeleton className="size-5 rounded-md" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-2">
        <div className="flex min-w-0 flex-col justify-center">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-1 h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-28 shrink-0" />
      </div>
    </div>
  );
}
