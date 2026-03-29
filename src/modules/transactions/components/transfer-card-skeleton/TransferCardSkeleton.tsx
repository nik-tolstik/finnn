import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function TransferCardSkeleton() {
  return (
    <Card className="relative overflow-hidden border border-border/60 px-4 py-4 text-sm shadow-sm">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-y-0 -left-1/3 w-1/2 -skew-x-12 animate-[shimmer_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-background/70 to-transparent" />
      </div>
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full bg-muted/80" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded-full bg-muted/80" />
              <Skeleton className="h-3 w-20 rounded-full bg-muted/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="ml-auto h-3 w-14 rounded-full bg-muted/70" />
            <Skeleton className="ml-auto h-5 w-24 rounded-full bg-muted/80" />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2 py-1">
              <Skeleton className="size-5 rounded-md bg-muted/80" />
              <Skeleton className="h-3.5 w-[4.5rem] rounded-full bg-muted/80" />
            </div>
            <Skeleton className="h-3.5 w-14 rounded-full bg-muted/55" />
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <Skeleton className="size-4 rounded-full bg-muted/65" />
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2 py-1">
              <Skeleton className="size-5 rounded-md bg-muted/80" />
              <Skeleton className="h-3.5 w-[4.5rem] rounded-full bg-muted/80" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
