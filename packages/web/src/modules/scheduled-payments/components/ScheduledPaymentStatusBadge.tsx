import { Badge } from "@/shared/ui/badge";

import { SCHEDULED_PAYMENT_DISPLAY_LABELS } from "../scheduled-payment.constants";

const STATUS_VARIANTS: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  due: "secondary",
  overdue: "destructive",
  paid: "default",
  skipped: "outline",
  upcoming: "secondary",
};

interface ScheduledPaymentStatusBadgeProps {
  status: string;
}

export function ScheduledPaymentStatusBadge({ status }: ScheduledPaymentStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>{SCHEDULED_PAYMENT_DISPLAY_LABELS[status] ?? status}</Badge>
  );
}
