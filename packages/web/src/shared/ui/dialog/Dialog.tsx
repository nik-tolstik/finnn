import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from "@floating-ui/react";
import { MoreVertical, XIcon } from "lucide-react";
import * as React from "react";

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Button } from "@/shared/ui/button";
import { OverlayPortalRootProvider } from "@/shared/ui/overlay-portal-root";
import { Popover } from "@/shared/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

interface DialogContextValue {
  descriptionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  titleId: string;
}

interface DialogProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export interface DialogAction {
  disabled?: boolean;
  icon: React.ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
  tone?: "default" | "destructive";
}

interface DialogWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: DialogAction[];
  closeButtonDisabled?: boolean;
  onCloseComplete?: () => void;
  showCloseButton?: boolean;
}

interface DialogWindowContextValue {
  actions: DialogAction[];
  hasActions: boolean;
  setNestedOverlayOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);
const DialogWindowContext = React.createContext<DialogWindowContextValue>({
  actions: [],
  hasActions: false,
  setNestedOverlayOpen: () => undefined,
});

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within Dialog");
  }
  return context;
}

function Dialog({ children, defaultOpen = false, onOpenChange, open }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const titleId = React.useId();
  const descriptionId = React.useId();

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const contextValue = React.useMemo(
    () => ({
      descriptionId,
      onOpenChange: setOpen,
      open: isOpen,
      titleId,
    }),
    [descriptionId, isOpen, setOpen, titleId]
  );

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
}

function DialogCloseButton({ className, children: _, type = "button", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      type={type}
      data-slot="dialog-close"
      aria-label="Закрыть"
      className={cn(
        "rounded-full p-1 text-[20px] transition-all hover:bg-control-hover active:bg-control-hover focus:ring-1 focus:ring-control-focus/20 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      <XIcon size="1em" />
    </button>
  );
}

function DialogActionList({
  actions,
  onSelect,
}: {
  actions: DialogAction[];
  onSelect: (action: DialogAction) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={action.disabled}
          onClick={() => onSelect(action)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-control-hover disabled:pointer-events-none disabled:opacity-50",
            action.tone === "destructive" ? "text-destructive" : "text-foreground"
          )}
        >
          <span className="shrink-0 [&_svg]:size-4">{action.icon}</span>
          <span className="min-w-0 flex-1 truncate">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function DialogOptionsButton({ actions }: { actions: DialogAction[] }) {
  const { isMobile } = useBreakpoints();
  const { setNestedOverlayOpen } = React.useContext(DialogWindowContext);
  const [open, setOpen] = React.useState(false);
  const disabled = actions.every((action) => action.disabled);

  React.useEffect(() => {
    setNestedOverlayOpen(isMobile && open);

    return () => setNestedOverlayOpen(false);
  }, [isMobile, open, setNestedOverlayOpen]);

  const handleSelect = (action: DialogAction) => {
    setOpen(false);
    action.onSelect();
  };

  if (isMobile) {
    return (
      <>
        <Button
          aria-label="Действия"
          aria-expanded={open}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(true)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreVertical />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[calc(100dvh-4rem)] gap-0 rounded-t-lg p-0"
          >
            <SheetHeader className="px-6 pb-3">
              <SheetTitle>Действия</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-3 pb-4">
              <DialogActionList actions={actions} onSelect={handleSelect} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      className="w-56 p-1"
      trigger={({ ref, ...triggerProps }) => (
        <Tooltip content="Действия" delayDuration={0} disableHoverableContent>
          <Button
            {...triggerProps}
            ref={ref}
            aria-label="Действия"
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical />
          </Button>
        </Tooltip>
      )}
    >
      <DialogActionList actions={actions} onSelect={handleSelect} />
    </Popover>
  );
}

function DialogWindow({
  actions = [],
  className,
  children,
  closeButtonDisabled = false,
  showCloseButton = true,
  onCloseComplete,
  style,
  ...props
}: DialogWindowProps) {
  const { descriptionId, onOpenChange, open, titleId } = useDialogContext();
  const { isMobile } = useBreakpoints();
  const hasActions = actions.length > 0;
  const [nestedOverlayOpen, setNestedOverlayOpen] = React.useState(false);
  const [portalRoot, setPortalRoot] = React.useState<HTMLDivElement | null>(null);
  const closeCompleteCalledRef = React.useRef(false);
  const wasMountedRef = React.useRef(false);

  const { context, refs } = useFloating({
    open,
    onOpenChange,
  });

  const dismiss = useDismiss(context, { outsidePress: !nestedOverlayOpen });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { close: 120, open: 180 },
    initial: isMobile ? { opacity: 0, transform: "translateY(100%)" } : { opacity: 0, transform: "scale(0.96)" },
    open: isMobile ? { opacity: 1, transform: "translateY(0)" } : { opacity: 1, transform: "scale(1)" },
    close: isMobile ? { opacity: 0, transform: "translateY(100%)" } : { opacity: 0, transform: "scale(0.96)" },
    common: { transformOrigin: isMobile ? "bottom center" : "center" },
  });

  React.useEffect(() => {
    if (isMounted) {
      wasMountedRef.current = true;
      closeCompleteCalledRef.current = false;
      return;
    }

    if (wasMountedRef.current && !open && !closeCompleteCalledRef.current) {
      closeCompleteCalledRef.current = true;
      wasMountedRef.current = false;
      onCloseComplete?.();
    }
  }, [isMounted, onCloseComplete, open]);

  const setFloatingRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs]
  );

  const dialogWindowContextValue = React.useMemo(
    () => ({ actions, hasActions, setNestedOverlayOpen }),
    [actions, hasActions]
  );

  if (!isMounted) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingOverlay
        lockScroll
        data-slot="dialog-overlay"
        data-state={open ? "open" : "closed"}
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 grid place-items-center bg-black/18 backdrop-blur-sm dark:bg-black/42"
      >
        <FloatingFocusManager context={context} initialFocus={-1} modal returnFocus>
          <DialogWindowContext.Provider value={dialogWindowContextValue}>
            <div
              {...getFloatingProps(props)}
              ref={setFloatingRef}
              data-slot="dialog-content"
              data-state={open ? "open" : "closed"}
              role="dialog"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className={cn(
                "fixed z-50 flex min-h-0 flex-col gap-6 bg-dialog py-6 shadow-lg outline-none",
                "max-w-dvw m-0 px-0 sm:max-h-dvh sm:w-125 sm:rounded-lg",
                isMobile
                  ? "bottom-0 left-0 h-auto w-dvw max-h-[calc(100dvh-4rem)] rounded-t-lg rounded-b-none"
                  : "top-[50%] left-[50%] h-fit translate-x-[-50%] translate-y-[-50%]",
                className
              )}
              style={{
                ...transitionStyles,
                ...style,
              }}
            >
              <OverlayPortalRootProvider root={portalRoot}>{children}</OverlayPortalRootProvider>
              <div
                ref={setPortalRoot}
                data-slot="dialog-overlay-portal-root"
                className="pointer-events-none absolute inset-0 z-50"
              />
              {(hasActions && isMobile) || (showCloseButton && !isMobile) ? (
                <div className="absolute top-4 right-4 flex items-center gap-1">
                  {hasActions && isMobile ? <DialogOptionsButton actions={actions} /> : null}
                  {showCloseButton && !isMobile ? (
                    <DialogCloseButton disabled={closeButtonDisabled} onClick={() => onOpenChange(false)} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogWindowContext.Provider>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}

function DialogContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 overflow-y-auto flex-1", className)} {...props} />;
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { hasActions } = React.useContext(DialogWindowContext);
  const { isMobile } = useBreakpoints();

  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 px-6 text-center sm:text-left", hasActions && isMobile && "pr-16", className)}
      {...props}
    />
  );
}

function DialogFooter({ children, className, ...props }: React.ComponentProps<"div">) {
  const { actions, hasActions } = React.useContext(DialogWindowContext);
  const { isMobile } = useBreakpoints();

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end px-6 [&>button:only-child]:w-full",
        className
      )}
      {...props}
    >
      {children}
      {hasActions && !isMobile ? (
        <span className="flex shrink-0">
          <DialogOptionsButton actions={actions} />
        </span>
      ) : null}
    </div>
  );
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<"h2">>(function DialogTitle(
  { className, id, ...props },
  ref
) {
  const { titleId } = useDialogContext();

  return (
    <h2
      ref={ref}
      id={id ?? titleId}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
});

function DialogDescription({ className, id, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useDialogContext();

  return (
    <p
      id={id ?? descriptionId}
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
};
