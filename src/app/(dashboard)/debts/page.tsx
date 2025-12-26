import { getWorkspaces } from "@/modules/workspace/actions";
import { getDebts } from "@/modules/debts/actions";
import { getAccounts } from "@/modules/accounts/actions";
import { CreateDebtForm } from "@/modules/debts/components/CreateDebtForm";
import { DebtsTable } from "@/modules/debts/components/DebtsTable";

export default async function DebtsPage() {
  const workspacesResult = await getWorkspaces();

  if (
    workspacesResult.error ||
    !workspacesResult.data ||
    workspacesResult.data.length === 0
  ) {
    return (
      <div>
        <h1 className="mb-4 text-3xl font-bold">Долги</h1>
        <p className="text-muted-foreground">
          Сначала создайте рабочий стол для управления долгами
        </p>
      </div>
    );
  }

  const workspaceId = workspacesResult.data[0].id;
  const debtsResult = await getDebts(workspaceId);
  const accountsResult = await getAccounts(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Долги</h1>
          <p className="text-muted-foreground">
            Управляйте своими долгами
          </p>
        </div>
        <CreateDebtForm
          workspaceId={workspaceId}
          accounts={
            accountsResult.data?.map((acc) => ({
              id: acc.id,
              name: acc.name,
              currency: acc.currency,
            })) || []
          }
        />
      </div>

      {debtsResult.error ? (
        <div className="text-center py-8 text-destructive">
          {debtsResult.error}
        </div>
      ) : (
        <DebtsTable
          debts={debtsResult.data || []}
          workspaceId={workspaceId}
          accounts={
            accountsResult.data?.map((acc) => ({
              id: acc.id,
              name: acc.name,
              currency: acc.currency,
            })) || []
          }
        />
      )}
    </div>
  );
}

