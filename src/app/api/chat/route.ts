import type { UIMessage } from "ai";
import { NextResponse } from "next/server";

import { createAssistantChatResponse } from "@/modules/assistant/server/assistant-chat.service";
import { getAssistantErrorMessage } from "@/modules/assistant/server/assistant-error";
import { getAssistantModelId } from "@/modules/assistant/server/assistant-model";
import { serverLogger } from "@/shared/lib/logger";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();

  try {
    return await createAssistantChatResponse({
      workspaceId,
      messages,
    });
  } catch (error) {
    serverLogger.error("[AI Assistant] Chat route error", {
      workspaceId,
      model: getAssistantModelId(),
      error: getAssistantErrorMessage(error),
    });

    return NextResponse.json({ error: getAssistantErrorMessage(error) }, { status: 500 });
  }
}
