"use client";

import { Bot } from "lucide-react";
import { useSession } from "next-auth/react";

import { UserAvatar } from "@/shared/components/UserAvatar";
import { cn } from "@/shared/utils/cn";

import { type AssistantChatMessage, isAssistantToolPart } from "../assistant.types";
import { AssistantToolPartCard } from "./AssistantToolPartCard";

interface AssistantMessageProps {
  message: AssistantChatMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const { data: session } = useSession();
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[88%] space-y-2 rounded-2xl px-4 py-3",
          isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <div
                key={`${message.id}-text-${index}`}
                className="whitespace-pre-wrap wrap-break-word text-sm leading-6"
              >
                {part.text}
              </div>
            );
          }

          if (isAssistantToolPart(part)) {
            return <AssistantToolPartCard key={part.toolCallId} part={part} />;
          }

          return null;
        })}
      </div>
      {isUser && (
        <UserAvatar
          name={session?.user?.name}
          email={session?.user?.email}
          image={session?.user?.image}
          size="lg"
          className="mt-1"
        />
      )}
    </div>
  );
}
