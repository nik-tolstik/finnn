"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { ASSISTANT_CHAT_ID_PREFIX } from "../assistant.constants";

interface UseAssistantChatOptions {
  workspaceId?: string;
}

export function useAssistantChat({ workspaceId }: UseAssistantChatOptions) {
  const transport = useMemo(() => {
    if (!workspaceId) {
      return undefined;
    }

    return new DefaultChatTransport({
      api: `/api/chat?workspaceId=${workspaceId}`,
    });
  }, [workspaceId]);

  const chat = useChat({
    id: `${ASSISTANT_CHAT_ID_PREFIX}${workspaceId ?? "unknown"}`,
    transport,
  });

  useEffect(() => {
    if (!chat.error) {
      return;
    }

    toast.error(chat.error.message || "Не удалось получить ответ ассистента");
  }, [chat.error]);

  const isBusy = chat.status === "submitted" || chat.status === "streaming";

  async function sendPrompt(prompt: string) {
    const content = prompt.trim();

    if (!workspaceId || !content || isBusy) {
      return;
    }

    chat.clearError();
    await chat.sendMessage({ text: content });
  }

  function clearConversation() {
    chat.setMessages([]);
    chat.clearError();
  }

  return {
    ...chat,
    isBusy,
    hasWorkspace: Boolean(workspaceId),
    hasMessages: chat.messages.length > 0,
    sendPrompt,
    clearConversation,
  };
}
