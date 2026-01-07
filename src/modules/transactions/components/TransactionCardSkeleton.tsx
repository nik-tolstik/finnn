import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function TransactionCardSkeleton() {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-2 mt-2 justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 py-1 rounded-lg">
            <Skeleton className="size-6 sm:size-7 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </Card>
  );
}
