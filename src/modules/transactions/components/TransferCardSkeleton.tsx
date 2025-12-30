import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function TransferCardSkeleton() {
  return (
    <Card className="p-3 sm:p-4 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
        <div className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-4 justify-between md:justify-start">
              <div className="flex flex-col items-start md:items-center md:flex-row gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Skeleton className="size-6 sm:size-7 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="size-4 shrink-0" />
              <div className="flex flex-col items-end md:items-center md:flex-row gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Skeleton className="size-6 sm:size-7 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

