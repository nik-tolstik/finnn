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
  onCloseComplete?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  titleId: string;
}

interface SheetProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onCloseComplete?: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean;
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

function Sheet({ children, defaultOpen = false, onCloseComplete, onOpenChange, open }: SheetProps) {
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
      onCloseComplete,
      onOpenChange: setOpen,
      open: isOpen,
      titleId,
    }),
    [descriptionId, isOpen, onCloseComplete, setOpen, titleId]
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

function SheetContent({
  className,
  children,
  showCloseButton = true,
  side = "right",
  style,
  ...props
}: SheetContentProps) {
  const { descriptionId, onCloseComplete, onOpenChange, open, titleId } = useSheetContext();
  const [portalRoot, setPortalRoot] = React.useState<HTMLDivElement | null>(null);
  const { context, refs } = useFloating({
    open,
    onOpenChange,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const closedTransform = side === "bottom" ? "scale(0.96)" : getClosedTransform(side);
  const openTransform = side === "bottom" ? "scale(1)" : "translate(0, 0)";
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { close: 120, open: 180 },
    initial: { opacity: 0, transform: closedTransform },
    open: { opacity: 1, transform: openTransform },
    close: { opacity: 0, transform: closedTransform },
    common: { transformOrigin: side === "bottom" ? "bottom center" : "center" },
  });
  const closeCompleteCalledRef = React.useRef(false);
  const wasMountedRef = React.useRef(false);

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
              "fixed z-50 flex flex-col gap-4 bg-dialog shadow-lg outline-none",
              side === "right" && "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm",
              side === "left" && "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm",
              side === "top" && "inset-x-0 top-0 h-auto",
              side === "bottom" && "inset-x-0 bottom-0 h-auto",
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
              data-slot="sheet-overlay-portal-root"
              className="pointer-events-none absolute inset-0 z-50"
            />
            {showCloseButton && (
              <button
                type="button"
                data-slot="sheet-close"
                className="absolute top-4 right-4 rounded-full p-1 text-[20px] transition-all hover:bg-control-hover active:bg-control-hover focus:ring-1 focus:ring-control-focus/20"
                onClick={() => onOpenChange(false)}
              >
                <XIcon size="1em" />
              </button>
            )}
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
