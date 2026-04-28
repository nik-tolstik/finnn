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

import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { OverlayPortalRootProvider } from "@/shared/ui/overlay-portal-root";
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

interface DialogWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  mobilePosition?: "center" | "bottom";
  onCloseComplete?: () => void;
  showCloseButton?: boolean;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

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

function DialogWindow({
  className,
  children,
  showCloseButton = true,
  onCloseComplete,
  mobilePosition = "center",
  style,
  ...props
}: DialogWindowProps) {
  const { descriptionId, onOpenChange, open, titleId } = useDialogContext();
  const { isMobile } = useBreakpoints();
  const [portalRoot, setPortalRoot] = React.useState<HTMLDivElement | null>(null);
  const closeCompleteCalledRef = React.useRef(false);
  const wasMountedRef = React.useRef(false);

  const { context, refs } = useFloating({
    open,
    onOpenChange,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { close: 120, open: 180 },
    initial: { opacity: 0, transform: "scale(0.96)" },
    open: { opacity: 1, transform: "scale(1)" },
    close: { opacity: 0, transform: "scale(0.96)" },
    common: { transformOrigin: "center" },
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
        data-slot="dialog-overlay"
        data-state={open ? "open" : "closed"}
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 grid place-items-center bg-black/18 backdrop-blur-sm dark:bg-black/42"
      >
        <FloatingFocusManager context={context} initialFocus={-1} modal returnFocus>
          <div
            {...getFloatingProps(props)}
            ref={setFloatingRef}
            data-slot="dialog-content"
            data-state={open ? "open" : "closed"}
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={cn(
              "flex flex-col gap-6",
              "bg-background fixed z-50 rounded-lg border p-6 shadow-lg outline-none",
              "sm:w-[500px] max-h-dvh max-w-dvw m-0 py-6 px-0",
              isMobile ? "w-dvw" : "top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] h-fit",
              isMobile &&
                mobilePosition === "center" &&
                "top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] h-dvh",
              isMobile && mobilePosition === "bottom" && "bottom-0 left-0 h-auto",
              className
            )}
            style={{
              ...transitionStyles,
              ...style,
            }}
          >
            <OverlayPortalRootProvider root={portalRoot}>{children}</OverlayPortalRootProvider>
            {showCloseButton && (
              <button
                type="button"
                data-slot="dialog-close"
                className="absolute top-4 right-4 text-[20px] active:bg-accent hover:bg-accent p-1 rounded-full transition-all focus:ring focus:ring-accent"
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

function DialogContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 overflow-y-auto flex-1", className)} {...props} />;
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left px-6", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end px-6", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, id, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext();

  return (
    <h2
      id={id ?? titleId}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

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

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow };
