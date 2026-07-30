import { AccountCardSkeleton } from "@/shared/components/AccountCardSkeleton";

export function AccountsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <AccountCardSkeleton key={index} className={index >= 3 ? "hidden md:flex" : undefined} />
      ))}
    </div>
  );
}
