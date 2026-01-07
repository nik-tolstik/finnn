import { TransactionCardSkeleton } from "./TransactionCardSkeleton";
import { TransferCardSkeleton } from "./TransferCardSkeleton";

interface TransactionsListSkeletonProps {
  count?: number;
}

export function TransactionsListSkeleton({ count = 10 }: TransactionsListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{index % 3 === 0 ? <TransferCardSkeleton /> : <TransactionCardSkeleton />}</div>
      ))}
    </div>
  );
}
