import type { ReactNode } from "react";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Popover, type PopoverTriggerRenderProps } from "@/shared/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";

export interface ActionItem {
  disabled?: boolean;
  icon: ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
  tone?: "default" | "destructive";
}

interface ActionsDialogBaseProps {
  actions: ActionItem[];
}

interface AnchoredActionsDialogProps extends ActionsDialogBaseProps {
  anchor: HTMLElement | null;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trigger?: never;
}

interface ContextMenuActionsDialogProps extends ActionsDialogBaseProps {
  anchor?: never;
  onCloseComplete?: () => void;
  onOpenChange?: never;
  open?: never;
  trigger: (props: PopoverTriggerRenderProps) => ReactNode;
}

export type ActionsDialogProps = AnchoredActionsDialogProps | ContextMenuActionsDialogProps;

function ActionList({ actions, onSelect }: { actions: ActionItem[]; onSelect: (action: ActionItem) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {actions.map((action) => (
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-control-hover disabled:pointer-events-none disabled:opacity-50",
            action.tone === "destructive" ? "text-destructive" : "text-foreground"
          )}
          disabled={action.disabled}
          key={action.id}
          onClick={() => onSelect(action)}
          type="button"
        >
          <span className="shrink-0 [&_svg]:size-4">{action.icon}</span>
          <span className="min-w-0 flex-1 truncate">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

const inertTriggerProps: PopoverTriggerRenderProps = {
  "aria-expanded": false,
  "data-slot": "popover-trigger",
  "data-state": "closed",
  ref: () => undefined,
};

export function ActionsDialog(props: ActionsDialogProps) {
  const { isMobile } = useBreakpoints();

  if (props.trigger) {
    const { actions, onCloseComplete, trigger } = props;

    if (isMobile) {
      return trigger(inertTriggerProps);
    }

    return (
      <Popover
        className="w-56 p-1"
        onCloseComplete={onCloseComplete}
        openOnContextMenu
        placement="bottom-end"
        trigger={trigger}
      >
        {({ close }) => (
          <ActionList
            actions={actions}
            onSelect={(action) => {
              close();
              action.onSelect();
            }}
          />
        )}
      </Popover>
    );
  }

  const { actions, anchor, onCloseComplete, onOpenChange, open } = props;
  const handleSelect = (action: ActionItem) => {
    onOpenChange(false);
    action.onSelect();
  };
  const actionList = <ActionList actions={actions} onSelect={handleSelect} />;

  if (isMobile) {
    return (
      <Sheet onCloseComplete={onCloseComplete} open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="max-h-[calc(100dvh-4rem)] gap-0 rounded-t-lg p-0"
          showCloseButton={false}
          side="bottom"
        >
          <SheetHeader className="px-6 pb-3">
            <SheetTitle>Действия</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-3 pb-4">{actionList}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover
      className="w-56 p-1"
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      open={open}
      placement="bottom-end"
      reference={anchor}
    >
      {actionList}
    </Popover>
  );
}
