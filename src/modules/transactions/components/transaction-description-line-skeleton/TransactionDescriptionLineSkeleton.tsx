import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";

interface TransactionDescriptionLineSkeletonProps {
  className?: string;
}

export function TransactionDescriptionLineSkeleton({ className }: TransactionDescriptionLineSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden p-4", className)}>
      <Skeleton className="h-6 w-1/3 rounded-full bg-secondary" />
    </Card>
  );
}
