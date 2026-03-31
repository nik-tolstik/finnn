import { prisma } from "@/shared/lib/prisma";

export interface AssistantWorkspaceContext {
  name: string;
  baseCurrency: string;
}

export async function getAssistantWorkspaceContext(workspaceId: string): Promise<AssistantWorkspaceContext> {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      name: true,
      baseCurrency: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace не найден");
  }

  return workspace;
}
