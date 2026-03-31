"use client";

import { Loader2 } from "lucide-react";

import type { AssistantChatMessage } from "../assistant.types";
import { AssistantMessage } from "./AssistantMessage";

interface AssistantConversationProps {
  messages: AssistantChatMessage[];
  isBusy: boolean;
}

export function AssistantConversation({ messages, isBusy }: AssistantConversationProps) {
  const lastMessageId = messages.at(-1)?.id ?? "empty";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        {messages.map((message) => (
          <AssistantMessage key={message.id} message={message} />
        ))}
        {isBusy && (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Ассистент думает...</span>
          </div>
        )}
        <div
          ref={(node) => {
            if (node) {
              node.scrollIntoView({ behavior: "smooth" });
            }
          }}
          data-message-anchor={lastMessageId}
        />
      </div>
    </div>
  );
}
