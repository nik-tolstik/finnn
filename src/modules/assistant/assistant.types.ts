import type { ToolUIPart, UIDataTypes, UIMessage, UIMessagePart, UITools } from "ai";

export interface AssistantSheetProps {
  workspaceId?: string;
  className?: string;
}

export type AssistantChatMessage = UIMessage;

export interface AssistantTextPart {
  type: "text";
  text: string;
}

export type AssistantToolPart = ToolUIPart<any>;

export function isAssistantTextPart(part: UIMessagePart<UIDataTypes, UITools>): part is AssistantTextPart {
  return part.type === "text";
}

export function isAssistantToolPart(part: UIMessagePart<UIDataTypes, UITools>): part is AssistantToolPart {
  return part.type.startsWith("tool-");
}
