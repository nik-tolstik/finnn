import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { Button } from "@/shared/ui/button";

import { AccountActionsDialog } from "./AccountActionsDialog";

const now = new Date("2026-08-04T00:00:00.000Z");

const account = {
  id: "account-bsb-bank",
  workspaceId: "workspace-family",
  ownerId: "user-nikita",
  name: "БСБ Банк",
  balance: "43231",
  initialBalance: "40000",
  currency: "BYN",
  description: null,
  color: "#ef4444",
  icon: "Landmark",
  archived: false,
  hidden: false,
  order: 1,
  createdAt: now,
  updatedAt: now,
  owner: {
    id: "user-nikita",
    name: "Никита",
    email: "nikita@example.com",
    image: null,
  },
} satisfies Account;

function AccountActionsDialogStory() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-[520px] items-start justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6">
      <Button ref={setAnchor} type="button" onClick={() => setOpen(true)}>
        Открыть действия счёта
      </Button>
      <AccountActionsDialog
        account={account}
        anchor={anchor}
        open={open && anchor !== null}
        onArchive={() => undefined}
        onCloseComplete={() => undefined}
        onCreateTransaction={() => undefined}
        onEdit={() => undefined}
        onOpenChange={setOpen}
        onToggleVisibility={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: "Finance/Account Actions Dialog",
  render: () => <AccountActionsDialogStory />,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
