import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";

interface AccountCardSkeletonProps {
  className?: string;
}

export function AccountCardSkeleton({ className }: AccountCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-[rgba(216,224,240,0.95)] bg-[rgba(255,255,255,0.96)] text-card-foreground shadow-[0_12px_32px_rgba(68,84,117,0.1)] bg-[linear-gradient(110deg,rgba(255,255,255,0.98)_0%,rgba(241,244,250,0.92)_60%,rgba(233,238,248,0.82)_100%)] backdrop-blur-sm backdrop-saturate-150 dark:border-[rgba(255,255,255,0.14)] dark:bg-[rgba(255,255,255,0.05)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.22)] dark:bg-[linear-gradient(110deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_60%,rgba(255,255,255,0.08)_100%)]",
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
