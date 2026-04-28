"use client";

import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  offset as floatingOffset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useInteractions,
  useRole,
  useTransitionStyles,
  type Placement,
} from "@floating-ui/react";
import * as React from "react";

import { useOverlayPortalRoot } from "@/shared/ui/overlay-portal-root";
import { cn } from "@/shared/utils/cn";

type PopoverTriggerRenderProps = Omit<React.HTMLAttributes<HTMLElement>, "ref"> & {
  "aria-expanded": boolean;
  "data-slot": "popover-trigger";
  "data-state": "open" | "closed";
  ref: React.RefCallback<HTMLElement>;
};

interface PopoverRenderProps {
  close: () => void;
  open: boolean;
}

interface PopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactNode | ((props: PopoverRenderProps) => React.ReactNode);
  defaultOpen?: boolean;
  offset?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  placement?: Placement;
  trigger: (props: PopoverTriggerRenderProps) => React.ReactNode;
}

function getPlacementParts(placement: Placement) {
  const [side, align = "center"] = placement.split("-");
  return { side, align };
}

function getClosedTransform(side: string) {
  switch (side) {
    case "top":
      return "translateY(0.25rem) scale(0.96)";
    case "right":
      return "translateX(-0.25rem) scale(0.96)";
    case "left":
      return "translateX(0.25rem) scale(0.96)";
    default:
      return "translateY(-0.25rem) scale(0.96)";
  }
}

function getTransformOrigin(side: string, align: string) {
  const crossAxis = align === "start" ? "left" : align === "end" ? "right" : "center";

  switch (side) {
    case "top":
      return `${crossAxis} bottom`;
    case "right":
      return "left center";
    case "left":
      return "right center";
    default:
      return `${crossAxis} top`;
  }
}

function PopoverInner({
  children,
  className,
  defaultOpen = false,
  offset = 4,
  onOpenChange,
  open,
  placement = "bottom",
  style,
  trigger,
  ...contentProps
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const nodeId = useFloatingNodeId();
  const portalRoot = useOverlayPortalRoot();
  const strategy = portalRoot ? "absolute" : "fixed";

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const {
    context,
    floatingStyles,
    refs,
    placement: resolvedPlacement,
  } = useFloating({
    nodeId,
    onOpenChange: setOpen,
    open: isOpen,
    placement,
    strategy,
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      floatingOffset(offset),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, availableWidth, elements, rects }) {
          elements.floating.style.setProperty("--popover-trigger-width", `${rects.reference.width}px`);
          elements.floating.style.setProperty("--popover-content-available-height", `${availableHeight}px`);
          elements.floating.style.setProperty("--popover-content-available-width", `${availableWidth}px`);
        },
      }),
    ],
  });

  const click = useClick(context, { keyboardHandlers: true });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps, getReferenceProps } = useInteractions([click, dismiss, role]);
  const { align, side } = getPlacementParts(resolvedPlacement);
  const closedTransform = getClosedTransform(side);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { close: 120, open: 180 },
    initial: {
      opacity: 0,
      transform: closedTransform,
    },
    open: {
      opacity: 1,
      transform: "translate(0, 0) scale(1)",
    },
    close: {
      opacity: 0,
      transform: closedTransform,
    },
    common: {
      transformOrigin: getTransformOrigin(side, align),
    },
  });

  const close = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const referenceProps = getReferenceProps() as React.HTMLAttributes<HTMLElement>;
  const triggerProps: PopoverTriggerRenderProps = {
    ...referenceProps,
    "aria-expanded": isOpen,
    "data-slot": "popover-trigger",
    "data-state": isOpen ? "open" : "closed",
    ref: refs.setReference as React.RefCallback<HTMLElement>,
  };
  const floatingInteractionProps = getFloatingProps(contentProps);

  return (
    <>
      {trigger(triggerProps)}
      <FloatingNode id={nodeId}>
        {isMounted && (
          <FloatingPortal root={portalRoot ?? undefined}>
            <FloatingFocusManager context={context} initialFocus={-1} modal={false}>
              <div
                {...floatingInteractionProps}
                ref={refs.setFloating}
                data-align={align}
                data-side={side}
                data-slot="popover-content"
                data-state={isOpen ? "open" : "closed"}
                className={cn(
                  "bg-card text-card-foreground z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
                  className
                )}
                style={{
                  ...floatingStyles,
                  ...transitionStyles,
                  ...style,
                }}
              >
                {typeof children === "function" ? children({ close, open: isOpen }) : children}
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  );
}

function Popover(props: PopoverProps) {
  const parentId = useFloatingParentNodeId();

  if (parentId === null) {
    return (
      <FloatingTree>
        <PopoverInner {...props} />
      </FloatingTree>
    );
  }

  return <PopoverInner {...props} />;
}

export { Popover, type PopoverProps, type PopoverRenderProps, type PopoverTriggerRenderProps };
