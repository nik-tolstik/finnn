import type { LucideIcon } from "lucide-react";

import { UserDisplay } from "@/shared/components/UserDisplay";

import type { TransactionAccountWithOwner } from "../../../transaction.types";

interface TransactionActorAvatarProps {
  account: TransactionAccountWithOwner;
  WorkspaceIcon: LucideIcon;
}

export function TransactionActorAvatar({ account, WorkspaceIcon }: TransactionActorAvatarProps) {
  if (account.ownerId === null) {
    return <WorkspaceIcon className="size-4" />;
  }

  return (
    <UserDisplay
      name={account.owner?.name}
      email={account.owner?.email}
      image={account.owner?.image}
      showName={false}
      size="sm"
    />
  );
}
