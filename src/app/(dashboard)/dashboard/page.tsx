import { getWorkspaces } from "@/modules/workspace/actions";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/CreateWorkspacePrompt";

export default async function DashboardPage() {
  const workspacesResult = await getWorkspaces();

  if (
    workspacesResult.error ||
    !workspacesResult.data ||
    workspacesResult.data.length === 0
  ) {
    return <CreateWorkspacePrompt />;
  }

  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">Панель управления</h1>
      <p>Добро пожаловать в ваш финансовый дашборд</p>
    </div>
  );
}
