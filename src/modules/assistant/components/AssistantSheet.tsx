"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

import type { AssistantSheetProps } from "../assistant.types";
import { useAssistantChat } from "../hooks/useAssistantChat";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantConversation } from "./AssistantConversation";
import { AssistantWelcome } from "./AssistantWelcome";

export function AssistantSheet({ workspaceId, className }: AssistantSheetProps) {
  const [open, setOpen] = useState(false);
  const { messages, isBusy, hasMessages, hasWorkspace, sendPrompt, regenerate, stop, clearConversation } =
    useAssistantChat({ workspaceId });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)} disabled={!workspaceId}>
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">AI ассистент</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="pr-12">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle>AI ассистент</SheetTitle>
            {hasMessages && (
              <Button variant="ghost" size="icon-sm" onClick={clearConversation} aria-label="Очистить чат">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          {hasMessages ? (
            <AssistantConversation messages={messages} isBusy={isBusy} />
          ) : (
            <AssistantWelcome
              onSelectPrompt={(prompt) => {
                sendPrompt(prompt);
              }}
            />
          )}

          <AssistantComposer
            hasWorkspace={hasWorkspace}
            hasMessages={hasMessages}
            isBusy={isBusy}
            onSendPrompt={sendPrompt}
            onRegenerate={regenerate}
            onStop={stop}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
