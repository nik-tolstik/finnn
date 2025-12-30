import { TransactionCardSkeleton } from "./TransactionCardSkeleton";
import { TransferCardSkeleton } from "./TransferCardSkeleton";

export function TransactionsListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index}>
          {index % 3 === 0 ? (
            <TransferCardSkeleton />
          ) : (
            <TransactionCardSkeleton />
          )}
        </div>
      ))}
    </div>
  );
}
