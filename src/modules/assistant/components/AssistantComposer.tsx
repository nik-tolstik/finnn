"use client";

import { RefreshCw, Send, Square } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

interface AssistantComposerProps {
  hasWorkspace: boolean;
  hasMessages: boolean;
  isBusy: boolean;
  onSendPrompt: (prompt: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onStop: () => void;
}

export function AssistantComposer({
  hasWorkspace,
  hasMessages,
  isBusy,
  onSendPrompt,
  onRegenerate,
  onStop,
}: AssistantComposerProps) {
  const [input, setInput] = useState("");
  const canSend = Boolean(hasWorkspace && input.trim() && !isBusy);

  async function handleSend() {
    const content = input.trim();

    if (!content) {
      return;
    }

    setInput("");
    await onSendPrompt(content);
  }

  async function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    await handleSend();
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          void handleKeyDown(event);
        }}
        placeholder="Напиши топ 3 категории по расходам за полгода"
        className="min-h-[96px] resize-none"
        disabled={!hasWorkspace}
      />

      <div className="inline-flex items-center gap-2 ml-auto">
        {isBusy && (
          <Button type="button" variant="outline" size="sm" onClick={onStop}>
            <Square className="size-4" />
            Стоп
          </Button>
        )}
        {!isBusy && hasMessages && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void onRegenerate();
            }}
          >
            <RefreshCw className="size-4" />
            Повторить
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void handleSend();
          }}
          disabled={!canSend}
        >
          <Send className="size-4" />
          Отправить
        </Button>
      </div>
    </div>
  );
}
