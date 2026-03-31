import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { format } from "date-fns";

import { serverLogger } from "@/shared/lib/logger";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";

import { getAssistantErrorMessage } from "./assistant-error";
import { getAssistantModel, getAssistantModelId } from "./assistant-model";
import { buildAssistantSystemPrompt } from "./assistant-prompt";
import { getAssistantWorkspaceContext } from "./assistant-workspace.service";
import { createAssistantTools } from "./tools/create-assistant-tools";

interface CreateAssistantChatResponseOptions {
  workspaceId: string;
  messages: UIMessage[];
}

export async function createAssistantChatResponse({ workspaceId, messages }: CreateAssistantChatResponseOptions) {
  await requireWorkspaceAccess(workspaceId);

  const workspace = await getAssistantWorkspaceContext(workspaceId);

  const result = streamText({
    model: getAssistantModel(),
    system: buildAssistantSystemPrompt({
      workspaceName: workspace.name,
      baseCurrency: workspace.baseCurrency,
      currentDate: format(new Date(), "yyyy-MM-dd"),
    }),
    messages: await convertToModelMessages(messages),
    tools: createAssistantTools({
      workspaceId,
      baseCurrency: workspace.baseCurrency,
    }),
    stopWhen: stepCountIs(5),
    temperature: 0.2,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      serverLogger.error("[AI Assistant] Stream error", {
        workspaceId,
        model: getAssistantModelId(),
        error: getAssistantErrorMessage(error),
      });

      return getAssistantErrorMessage(error);
    },
  });
}
