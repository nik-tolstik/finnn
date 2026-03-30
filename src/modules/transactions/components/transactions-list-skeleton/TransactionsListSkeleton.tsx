import { TransactionDescriptionLineSkeleton } from "../transaction-description-line-skeleton/TransactionDescriptionLineSkeleton";

interface TransactionsListSkeletonProps {
  count?: number;
}

export function TransactionsListSkeleton({ count = 10 }: TransactionsListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          {index === 0 || index % 5 === 0 ? (
            <div className="py-2">
              <div className="h-5 w-20 rounded-full bg-secondary animate-pulse" />
            </div>
          ) : null}
          {index % 2 === 0 && <TransactionDescriptionLineSkeleton />}
        </div>
      ))}
    </div>
  );
}
