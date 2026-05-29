import { Plus } from "lucide-react";

import { AccountCardSkeleton } from "@/shared/components/AccountCardSkeleton";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

export function AccountsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <AccountCardSkeleton key={index} />
      ))}
      <Card
        className={cn(
          "group relative transition-all hover:shadow-md cursor-pointer border-dashed hover:border-primary hover:bg-accent/50"
        )}
      >
        <div className="flex items-center justify-center h-full w-full">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
      </Card>
    </div>
  );
}
