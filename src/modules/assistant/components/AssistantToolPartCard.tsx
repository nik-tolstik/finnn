"use client";

import { Loader2 } from "lucide-react";

import type { AssistantToolPart } from "../assistant.types";
import { summarizeAssistantToolOutput } from "../utils/summarize-tool-output";

interface AssistantToolPartCardProps {
  part: AssistantToolPart;
}

export function AssistantToolPartCard({ part }: AssistantToolPartCardProps) {
  const toolName = part.type.replace(/^tool-/, "");

  if (part.state === "output-error") {
    return <div className="text-sm text-muted-foreground">{part.errorText ?? "Не удалось получить данные"}</div>;
  }

  if (part.state === "output-available") {
    return <div className="text-foreground text-sm">{summarizeAssistantToolOutput(toolName, part.output)}</div>;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      <span>Собираю данные для ответа...</span>
    </div>
  );
}
