import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

export interface ActionItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  theme?: ActionButtonTheme;
  className?: string;
}

interface ActionsDialogProps {
  title: string;
  description: string;
  actions: ActionItem[];
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
}

type ActionButtonTheme = "primary" | "error" | "secondary";

const colorMap: Record<ActionButtonTheme, string> = {
  primary: "text-foreground",
  error: "text-destructive",
  secondary: "text-secondary-foreground",
};

function ActionButton({
  icon,
  children,
  onClick,
  theme = "primary",
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  theme?: ActionButtonTheme;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-4 text-left transition-colors hover:bg-control-hover",
        colorMap[theme],
        className
      )}
    >
      {icon}
      <div className="font-medium">{children}</div>
    </button>
  );
}

export function ActionsDialog({
  title,
  description,
  actions,
  open,
  onCloseComplete,
  onOpenChange,
}: ActionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[400px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-1">
          {actions.map((action, index) => (
            <ActionButton
              key={index}
              icon={action.icon}
              onClick={action.onClick}
              theme={action.theme}
              className={action.className}
            >
              {action.label}
            </ActionButton>
          ))}
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
