import { Building2 } from "lucide-react";

import { UserDisplay } from "@/shared/components/UserDisplay";

import type { TransactionAccountWithOwner } from "../../../transaction.types";

interface TransactionActorAvatarProps {
  account: TransactionAccountWithOwner;
  showName?: boolean;
  workspaceName?: string;
}

export function TransactionActorAvatar({ account, showName = false, workspaceName }: TransactionActorAvatarProps) {
  if (account.ownerId === null) {
    return (
      <span className="flex items-center gap-1 text-xs font-normal text-foreground/75">
        <Building2 className="size-4" />
        {showName ? <span>{workspaceName || "Общие"}</span> : null}
      </span>
    );
  }

  return (
    <UserDisplay
      name={account.owner?.name}
      email={account.owner?.email}
      image={account.owner?.image}
      showName={showName}
      size="sm"
    />
  );
}
