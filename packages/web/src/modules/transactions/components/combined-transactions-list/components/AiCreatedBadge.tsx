import { Bot } from "lucide-react";

import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

interface AiCreatedBadgeProps {
  className?: string;
}

export function AiCreatedBadge({ className }: AiCreatedBadgeProps) {
  return (
    <Tooltip content="Создано с помощью ИИ" delayDuration={0}>
      <span
        aria-label="Создано с помощью ИИ"
        role="img"
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary",
          className
        )}
      >
        <Bot className="size-3.5" />
      </span>
    </Tooltip>
  );
}
