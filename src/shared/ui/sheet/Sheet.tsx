"use client";

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
import { XIcon } from "lucide-react";
import * as React from "react";

import { OverlayPortalRootProvider } from "@/shared/ui/overlay-portal-root";
import { cn } from "@/shared/utils/cn";

type SheetSide = "top" | "right" | "bottom" | "left";

interface SheetContextValue {
  descriptionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  titleId: string;
}

interface SheetProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: SheetSide;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within Sheet");
  }
  return context;
}

function Sheet({ children, defaultOpen = false, onOpenChange, open }: SheetProps) {
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

  return <SheetContext.Provider value={contextValue}>{children}</SheetContext.Provider>;
}

function getClosedTransform(side: SheetSide) {
  switch (side) {
    case "left":
      return "translateX(-100%)";
    case "right":
      return "translateX(100%)";
    case "top":
      return "translateY(-100%)";
    case "bottom":
      return "translateY(100%)";
  }
}

function SheetContent({ className, children, side = "right", style, ...props }: SheetContentProps) {
  const { descriptionId, onOpenChange, open, titleId } = useSheetContext();
  const [portalRoot, setPortalRoot] = React.useState<HTMLDivElement | null>(null);
  const { context, refs } = useFloating({
    open,
    onOpenChange,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const closedTransform = getClosedTransform(side);
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { close: 120, open: 180 },
    initial: { opacity: 0, transform: closedTransform },
    open: { opacity: 1, transform: "translate(0, 0)" },
    close: { opacity: 0, transform: closedTransform },
  });

  const setFloatingRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
      setPortalRoot(node);
    },
    [refs]
  );

  if (!isMounted) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingOverlay
        lockScroll
        data-slot="sheet-overlay"
        data-state={open ? "open" : "closed"}
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/28 backdrop-blur-sm dark:bg-black/62"
      >
        <FloatingFocusManager context={context} initialFocus={-1} modal returnFocus>
          <div
            {...getFloatingProps(props)}
            ref={setFloatingRef}
            data-slot="sheet-content"
            data-state={open ? "open" : "closed"}
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={cn(
              "bg-background fixed z-50 flex flex-col gap-4 shadow-lg outline-none",
              side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
              side === "left" && "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
              side === "top" && "inset-x-0 top-0 h-auto border-b",
              side === "bottom" && "inset-x-0 bottom-0 h-auto border-t",
              className
            )}
            style={{
              ...transitionStyles,
              ...style,
            }}
          >
            <OverlayPortalRootProvider root={portalRoot}>{children}</OverlayPortalRootProvider>
            <button
              type="button"
              data-slot="sheet-close"
              className="absolute top-4 right-4 text-[20px] active:bg-accent hover:bg-accent p-1 rounded-full transition-all focus:ring focus:ring-accent"
              onClick={() => onOpenChange(false)}
            >
              <XIcon size="1em" />
            </button>
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 pt-4 px-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function SheetTitle({ className, id, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useSheetContext();

  return (
    <h2
      id={id ?? titleId}
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, id, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useSheetContext();

  return (
    <p
      id={id ?? descriptionId}
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle };
