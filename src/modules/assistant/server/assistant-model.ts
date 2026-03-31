import { google } from "@ai-sdk/google";

export function getAssistantModelId() {
  const configuredModel = process.env.AI_ASSISTANT_MODEL?.trim();

  if (configuredModel) {
    return configuredModel;
  }

  throw new Error("Assistant model is not provided");
}

export function getAssistantModel() {
  return google(getAssistantModelId());
}
