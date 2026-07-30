import { ArrowDownUp, Group, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import type {
  AccountDisplayGrouping,
  AccountDisplaySort,
} from "@/modules/accounts/components/accounts-cards/account-display";
import type { AccountDisplayPreferences } from "@/modules/accounts/hooks/useAccountDisplayPreferences";
import { Button } from "@/shared/ui/button";
import { Popover } from "@/shared/ui/popover";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

export type BalanceSortStatus = "error" | "idle" | "loading" | "ready";

interface AccountDisplayControlsProps {
  balanceSortStatus: BalanceSortStatus;
  onCreateAccount: () => void;
  onGroupingChange: (grouping: AccountDisplayGrouping) => void;
  onSortChange: (sort: AccountDisplaySort) => void;
  preferences: AccountDisplayPreferences;
}

const SORT_OPTIONS: Array<{ label: string; value: AccountDisplaySort }> = [
  { label: "Название", value: "name" },
  { label: "Сумма", value: "balance" },
  { label: "Своя", value: "custom" },
];

const GROUPING_OPTIONS: Array<{ label: string; value: AccountDisplayGrouping }> = [
  { label: "Без группы", value: "none" },
  { label: "Владелец", value: "owner" },
  { label: "Валюта", value: "currency" },
];

function getSortLabel(preferences: AccountDisplayPreferences) {
  return `Сортировка: ${SORT_OPTIONS.find((option) => option.value === preferences.sort)?.label}`;
}

function getGroupingLabel(grouping: AccountDisplayGrouping) {
  return `Группировка: ${GROUPING_OPTIONS.find((option) => option.value === grouping)?.label}`;
}

function MenuOption({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-10 w-full items-center rounded-md px-3 py-2 text-left text-sm font-normal transition-colors hover:bg-accent",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

interface AccountSortOptionsProps {
  onSelect?: () => void;
  onSortChange: (sort: AccountDisplaySort) => void;
  preferences: AccountDisplayPreferences;
}

export function AccountSortOptions({ onSelect, onSortChange, preferences }: AccountSortOptionsProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 pb-2 pt-1 text-sm text-muted-foreground">
        <ArrowDownUp className="size-4" />
        <span>Сортировка</span>
      </div>
      {SORT_OPTIONS.map((option) => (
        <MenuOption
          active={preferences.sort === option.value}
          key={option.value}
          onClick={() => {
            onSortChange(option.value);
            onSelect?.();
          }}
        >
          {option.label}
        </MenuOption>
      ))}
    </div>
  );
}

interface AccountGroupingOptionsProps {
  onGroupingChange: (grouping: AccountDisplayGrouping) => void;
  onSelect?: () => void;
  preferences: AccountDisplayPreferences;
}

export function AccountGroupingOptions({ onGroupingChange, onSelect, preferences }: AccountGroupingOptionsProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 pb-2 pt-1 text-sm text-muted-foreground">
        <Group className="size-4" />
        <span>Группировка</span>
      </div>
      {GROUPING_OPTIONS.map((option) => (
        <MenuOption
          active={preferences.grouping === option.value}
          key={option.value}
          onClick={() => {
            onGroupingChange(option.value);
            onSelect?.();
          }}
        >
          {option.label}
        </MenuOption>
      ))}
    </div>
  );
}

export function AccountDisplayControls({
  onCreateAccount,
  onGroupingChange,
  onSortChange,
  preferences,
}: AccountDisplayControlsProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [groupingOpen, setGroupingOpen] = useState(false);

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Popover
        open={sortOpen}
        onOpenChange={setSortOpen}
        placement="bottom-end"
        className="w-60 p-2"
        trigger={({ ref, ...triggerProps }) => (
          <Tooltip content={getSortLabel(preferences)} disableHoverableContent>
            <Button
              ref={ref}
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label={getSortLabel(preferences)}
              {...triggerProps}
            >
              <ArrowDownUp className="size-4" />
            </Button>
          </Tooltip>
        )}
      >
        <AccountSortOptions preferences={preferences} onSortChange={onSortChange} onSelect={() => setSortOpen(false)} />
      </Popover>

      <Popover
        open={groupingOpen}
        onOpenChange={setGroupingOpen}
        placement="bottom-end"
        className="w-52 p-2"
        trigger={({ ref, ...triggerProps }) => (
          <Tooltip content={getGroupingLabel(preferences.grouping)} disableHoverableContent>
            <Button
              ref={ref}
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label={getGroupingLabel(preferences.grouping)}
              {...triggerProps}
            >
              <Group className="size-4" />
            </Button>
          </Tooltip>
        )}
      >
        <AccountGroupingOptions
          preferences={preferences}
          onGroupingChange={onGroupingChange}
          onSelect={() => setGroupingOpen(false)}
        />
      </Popover>

      <Tooltip content="Новый счёт" disableHoverableContent>
        <Button type="button" variant="secondary" size="icon-sm" aria-label="Новый счёт" onClick={onCreateAccount}>
          <Plus className="size-4" />
        </Button>
      </Tooltip>
    </div>
  );
}
