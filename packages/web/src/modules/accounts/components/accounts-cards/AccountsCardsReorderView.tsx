import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Account } from "@/modules/accounts/account.types";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { cn } from "@/shared/utils/cn";

type AccountWithOwner = Account & {
  owner: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  } | null;
};

interface AccountsCardsReorderViewProps {
  accounts: AccountWithOwner[];
  disabled?: boolean;
  onAccountsChange: (accounts: AccountWithOwner[]) => void;
}

interface SortableAccountCardProps {
  account: AccountWithOwner;
  disabled?: boolean;
}

function SortableAccountCard({ account, disabled = false }: SortableAccountCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    disabled,
    id: account.id,
  });
  const style = {
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="w-full min-w-0">
      <div
        {...attributes}
        {...listeners}
        aria-disabled={disabled || undefined}
        className={cn(
          "w-full min-w-0 select-none touch-none",
          disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        )}
        style={{
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <AccountCard account={account} showOwner />
      </div>
    </div>
  );
}

export function AccountsCardsReorderView({
  accounts,
  disabled = false,
  onAccountsChange,
}: AccountsCardsReorderViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) {
      return;
    }

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = accounts.findIndex((account) => account.id === active.id);
    const newIndex = accounts.findIndex((account) => account.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onAccountsChange(arrayMove(accounts, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={accounts.map((account) => account.id)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <SortableAccountCard key={account.id} account={account} disabled={disabled} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
