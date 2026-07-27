import { CircleCheck, Info, type LucideIcon, OctagonX, TriangleAlert } from "lucide-react";
import type * as React from "react";

import { cn } from "@/shared/utils/cn";

export type AlertStatus = "success" | "warning" | "error" | "info";

const alertStyles: Record<AlertStatus, string> = {
  success: "bg-success/10 text-success dark:bg-success/15",
  warning: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-400",
  error: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  info: "bg-primary/10 text-primary dark:bg-primary/15",
};

const alertIcons: Record<AlertStatus, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: OctagonX,
  info: Info,
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: AlertStatus;
}

export function Alert({ className, status = "info", children, ...props }: AlertProps) {
  const Icon = alertIcons[status];

  return (
    <div
      {...props}
      role="alert"
      data-status={status}
      data-slot="alert"
      className={cn("flex items-start gap-2 rounded-md px-3 py-2.5 text-sm", alertStyles[status], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
