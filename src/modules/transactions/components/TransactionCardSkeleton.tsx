import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function TransactionCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden border border-border/60 px-4 py-4 shadow-sm">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-y-0 -left-1/3 w-1/2 -skew-x-12 animate-[shimmer_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-background/70 to-transparent" />
      </div>
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full bg-muted/80" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded-full bg-muted/80" />
              <Skeleton className="h-3 w-28 rounded-full bg-muted/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="ml-auto h-3 w-14 rounded-full bg-muted/70" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full bg-muted/80" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2 py-1">
            <Skeleton className="size-5 rounded-md bg-muted/80" />
            <Skeleton className="h-3.5 w-[4.5rem] rounded-full bg-muted/80" />
          </div>
          <Skeleton className="h-3.5 w-16 rounded-full bg-muted/60" />
          <Skeleton className="h-6 w-24 rounded-md bg-muted/65" />
        </div>

        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full rounded-full bg-muted/55" />
          <Skeleton className="h-3 w-2/3 rounded-full bg-muted/45" />
        </div>
      </div>
    </Card>
  );
}
