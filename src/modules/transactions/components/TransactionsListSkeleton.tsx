import { TransactionCardSkeleton } from "./TransactionCardSkeleton";
import { TransferCardSkeleton } from "./TransferCardSkeleton";

interface TransactionsListSkeletonProps {
  count?: number;
}

export function TransactionsListSkeleton({ count = 10 }: TransactionsListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          {index === 0 || index % 4 === 0 ? (
            <div className="sticky top-16 z-10 bg-background py-2">
              <div className="h-3 w-28 rounded-full bg-muted/70 animate-pulse" />
            </div>
          ) : null}
          {index % 3 === 0 ? <TransferCardSkeleton /> : <TransactionCardSkeleton />}
        </div>
      ))}
    </div>
  );
}
