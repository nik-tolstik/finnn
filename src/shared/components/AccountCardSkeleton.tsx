import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";

interface AccountCardSkeletonProps {
  className?: string;
}

export function AccountCardSkeleton({ className }: AccountCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-card text-card-foreground flex flex-col rounded-xl shadow-sm",
        className
      )}
    >
      <div className="flex flex-col items-start gap-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="shrink-0">
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
