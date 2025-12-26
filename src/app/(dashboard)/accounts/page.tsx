import { getWorkspaces } from "@/modules/workspace/actions";
import { getAccounts } from "@/modules/accounts/actions";
import { CreateAccountForm } from "@/modules/accounts/components/CreateAccountForm";
import { AccountsTable } from "@/modules/accounts/components/AccountsTable";

export default async function AccountsPage() {
  const workspacesResult = await getWorkspaces();

  if (
    workspacesResult.error ||
    !workspacesResult.data ||
    workspacesResult.data.length === 0
  ) {
    return (
      <div>
        <h1 className="mb-4 text-3xl font-bold">Счета</h1>
        <p className="text-muted-foreground">
          Сначала создайте рабочий стол для управления счетами
        </p>
      </div>
    );
  }

  const workspaceId = workspacesResult.data[0].id;
  const accountsResult = await getAccounts(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Счета</h1>
          <p className="text-muted-foreground">
            Управляйте своими счетами
          </p>
        </div>
        <CreateAccountForm workspaceId={workspaceId} />
      </div>

      {accountsResult.error ? (
        <div className="text-center py-8 text-destructive">
          {accountsResult.error}
        </div>
      ) : (
        <AccountsTable accounts={accountsResult.data || []} />
      )}
    </div>
  );
}

