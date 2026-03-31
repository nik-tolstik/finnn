"use client";

import { Send } from "lucide-react";

import { ASSISTANT_SUGGESTED_PROMPTS } from "../assistant.constants";

interface AssistantWelcomeProps {
  onSelectPrompt: (prompt: string) => void;
}

export function AssistantWelcome({ onSelectPrompt }: AssistantWelcomeProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {ASSISTANT_SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => {
            onSelectPrompt(prompt);
          }}
          className="flex items-center group text-sm text-left bg-secondary/50 p-3 rounded-md hover:bg-secondary/70 transition-colors"
        >
          <span>{prompt}</span>
          <Send className="group-hover:opacity-100 opacity-0 size-4 ml-auto text-secondary-foreground/60 transition-opacity" />
        </button>
      ))}
    </div>
  );
}
