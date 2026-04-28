"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset as floatingOffset,
  safePolygon,
  shift,
  size,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles,
  type Placement,
} from "@floating-ui/react";
import * as React from "react";

import { useOverlayPortalRoot } from "@/shared/ui/overlay-portal-root";
import { cn } from "@/shared/utils/cn";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";
type TooltipTriggerProps = React.HTMLAttributes<HTMLElement> &
  React.RefAttributes<HTMLElement> & {
    "data-slot"?: string;
  };

interface TooltipProps {
  align?: TooltipAlign;
  alignOffset?: number;
  avoidCollisions?: boolean;
  children: React.ReactElement<TooltipTriggerProps>;
  closeDelayDuration?: number;
  collisionPadding?: number;
  content: React.ReactNode;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  defaultOpen?: boolean;
  delayDuration?: number;
  disabled?: boolean;
  disableHoverableContent?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  side?: TooltipSide;
  sideOffset?: number;
}

function getPlacement(side: TooltipSide, align: TooltipAlign): Placement {
  return align === "center" ? side : `${side}-${align}`;
}

function getPlacementParts(placement: Placement) {
  const [side, align = "center"] = placement.split("-") as [TooltipSide, TooltipAlign?];
  return { side, align };
}

function getClosedTransform(side: TooltipSide) {
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

function getTransformOrigin(side: TooltipSide, align: TooltipAlign) {
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

function Tooltip({
  align = "center",
  alignOffset = 0,
  avoidCollisions = true,
  children,
  closeDelayDuration = 0,
  collisionPadding = 8,
  content,
  contentClassName,
  contentStyle,
  defaultOpen = false,
  delayDuration = 700,
  disabled = false,
  disableHoverableContent = false,
  onOpenChange,
  open,
  side = "top",
  sideOffset = 4,
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const hasContent = content !== null && content !== undefined && content !== false;
  const canOpen = !disabled && hasContent;
  const isOpen = canOpen && (isControlled ? open : uncontrolledOpen);
  const contentId = React.useId();
  const portalRoot = useOverlayPortalRoot();
  const strategy = portalRoot ? "absolute" : "fixed";

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      const resolvedOpen = canOpen && nextOpen;

      if (!isControlled) {
        setUncontrolledOpen(resolvedOpen);
      }

      onOpenChange?.(resolvedOpen);
    },
    [canOpen, isControlled, onOpenChange]
  );

  const middleware = React.useMemo(
    () => [
      floatingOffset({ mainAxis: sideOffset, crossAxis: alignOffset }),
      ...(avoidCollisions ? [flip({ padding: collisionPadding }), shift({ padding: collisionPadding })] : []),
      size({
        padding: collisionPadding,
        apply({ availableHeight, availableWidth, elements, rects }) {
          elements.floating.style.setProperty("--radix-tooltip-trigger-width", `${rects.reference.width}px`);
          elements.floating.style.setProperty("--radix-tooltip-content-available-height", `${availableHeight}px`);
          elements.floating.style.setProperty("--radix-tooltip-content-available-width", `${availableWidth}px`);
        },
      }),
    ],
    [alignOffset, avoidCollisions, collisionPadding, sideOffset]
  );

  const {
    context,
    floatingStyles,
    refs,
    placement: resolvedPlacement,
  } = useFloating({
    onOpenChange: setOpen,
    open: isOpen,
    placement: getPlacement(side, align),
    strategy,
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware,
  });

  const hover = useHover(context, {
    delay: { open: delayDuration, close: closeDelayDuration },
    enabled: canOpen,
    handleClose: disableHoverableContent ? undefined : safePolygon(),
    mouseOnly: true,
    move: false,
  });
  const focus = useFocus(context, { enabled: canOpen });
  const dismiss = useDismiss(context, { enabled: canOpen });
  const role = useRole(context, { role: "tooltip" });
  const { getFloatingProps, getReferenceProps } = useInteractions([hover, focus, dismiss, role]);
  const { align: resolvedAlign, side: resolvedSide } = getPlacementParts(resolvedPlacement);
  const closedTransform = getClosedTransform(resolvedSide);

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
      transformOrigin: getTransformOrigin(resolvedSide, resolvedAlign),
    },
  });

  const childProps = children.props;
  const referenceRef = useMergeRefs([refs.setReference, childProps.ref]);
  const referenceProps = getReferenceProps({
    ...childProps,
    "aria-describedby": isMounted ? contentId : childProps["aria-describedby"],
    "data-slot": childProps["data-slot"] ?? "tooltip-trigger",
    ref: referenceRef,
  } as React.HTMLProps<Element> & TooltipTriggerProps);
  const floatingInteractionProps = getFloatingProps();

  return (
    <>
      {React.cloneElement(children, referenceProps)}
      {isMounted && (
        <FloatingPortal root={portalRoot ?? undefined}>
          <div
            {...floatingInteractionProps}
            id={contentId}
            ref={refs.setFloating}
            data-align={resolvedAlign}
            data-side={resolvedSide}
            data-slot="tooltip-content"
            data-state={isOpen ? "open" : "closed"}
            className={cn(
              "z-50 overflow-hidden rounded-md border bg-card px-3 py-1.5 text-xs text-card-foreground shadow-md outline-hidden",
              contentClassName
            )}
            style={
              {
                ...floatingStyles,
                ...transitionStyles,
                "--radix-tooltip-content-transform-origin": getTransformOrigin(resolvedSide, resolvedAlign),
                ...contentStyle,
              } as React.CSSProperties
            }
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export { Tooltip, type TooltipProps };
