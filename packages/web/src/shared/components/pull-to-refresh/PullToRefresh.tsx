import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  canStartPullToRefresh,
  getPullToRefreshContentOffset,
  getPullToRefreshMoveState,
  PULL_TO_REFRESH_THRESHOLD_PX,
  type PullToRefreshPhase,
  shouldIgnorePullToRefreshTarget,
  shouldReloadOnPullToRefreshRelease,
} from "@/shared/lib/pull-to-refresh";

interface ActivePullToRefreshGesture {
  phase: "pulling" | "ready";
  pointerId: number;
  startX: number;
  startY: number;
}

const PULL_TO_REFRESH_TOP_ATTRIBUTE = "data-pull-to-refresh-top";

function getIndicatorAccessibleLabel(phase: PullToRefreshPhase): string {
  switch (phase) {
    case "ready":
      return "Готово к обновлению";
    case "refreshing":
      return "Обновление";
    case "pulling":
      return "Потяните для обновления";
    default:
      return "";
  }
}

export function PullToRefresh() {
  const [phase, setPhase] = useState<PullToRefreshPhase>("idle");
  const activeGestureRef = useRef<ActivePullToRefreshGesture | null>(null);
  const isRefreshingRef = useRef(false);
  const touchSequenceActiveRef = useRef(false);

  useEffect(() => {
    const setIndicatorPosition = (distance: number) => {
      const root = document.documentElement;
      const contentOffset = getPullToRefreshContentOffset(distance);
      root.style.setProperty("--pull-content-offset", `${contentOffset}px`);
      root.toggleAttribute("data-pull-to-refresh-active", contentOffset > 0);
    };

    const resetGesture = () => {
      activeGestureRef.current = null;
      setIndicatorPosition(0);
      setPhase("idle");
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        isRefreshingRef.current ||
        activeGestureRef.current ||
        !canStartPullToRefresh({
          isPrimary: event.isPrimary,
          pointerType: event.pointerType,
          scrollY: window.scrollY,
          targetIgnored: shouldIgnorePullToRefreshTarget(event.target),
        })
      ) {
        return;
      }

      touchSequenceActiveRef.current = event.pointerType === "touch";
      activeGestureRef.current = {
        phase: "pulling",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      setIndicatorPosition(0);
      setPhase("pulling");
    };

    const handlePointerMove = (event: PointerEvent) => {
      const activeGesture = activeGestureRef.current;
      if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
        return;
      }

      const nextState = getPullToRefreshMoveState({
        currentX: event.clientX,
        currentY: event.clientY,
        scrollY: window.scrollY,
        startX: activeGesture.startX,
        startY: activeGesture.startY,
      });

      if (!nextState) {
        resetGesture();
        return;
      }

      // Keep the browser from starting native scrolling and cancelling the pointer sequence.
      event.preventDefault();
      activeGesture.phase = nextState.phase;
      setIndicatorPosition(nextState.distance);
      setPhase(nextState.phase);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (touchSequenceActiveRef.current || activeGestureRef.current || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      if (
        !canStartPullToRefresh({
          isPrimary: true,
          pointerType: "touch",
          scrollY: window.scrollY,
          targetIgnored: shouldIgnorePullToRefreshTarget(event.target),
        })
      ) {
        return;
      }

      touchSequenceActiveRef.current = true;
      activeGestureRef.current = {
        phase: "pulling",
        pointerId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
      };
      setIndicatorPosition(0);
      setPhase("pulling");
    };

    const handleTouchMove = (event: TouchEvent) => {
      const activeGesture = activeGestureRef.current;
      const touch = event.touches[0];
      if (!activeGesture || !touch || event.touches.length !== 1) {
        if (activeGesture && event.touches.length !== 1) {
          resetGesture();
        }
        return;
      }

      const nextState = getPullToRefreshMoveState({
        currentX: touch.clientX,
        currentY: touch.clientY,
        scrollY: window.scrollY,
        startX: activeGesture.startX,
        startY: activeGesture.startY,
      });

      if (!nextState) {
        resetGesture();
        return;
      }

      event.preventDefault();
      activeGesture.phase = nextState.phase;
      setIndicatorPosition(nextState.distance);
      setPhase(nextState.phase);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const activeGesture = activeGestureRef.current;
      if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
        return;
      }

      if (shouldReloadOnPullToRefreshRelease(activeGesture.phase)) {
        activeGestureRef.current = null;
        isRefreshingRef.current = true;
        setIndicatorPosition(PULL_TO_REFRESH_THRESHOLD_PX);
        setPhase("refreshing");
        window.location.reload();
        return;
      }

      resetGesture();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activeGestureRef.current?.pointerId === event.pointerId) {
        if (event.pointerType === "touch" && touchSequenceActiveRef.current) {
          return;
        }
        resetGesture();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        return;
      }

      touchSequenceActiveRef.current = false;
      const activeGesture = activeGestureRef.current;
      if (!activeGesture) {
        return;
      }

      if (shouldReloadOnPullToRefreshRelease(activeGesture.phase)) {
        activeGestureRef.current = null;
        isRefreshingRef.current = true;
        setIndicatorPosition(PULL_TO_REFRESH_THRESHOLD_PX);
        setPhase("refreshing");
        window.location.reload();
        return;
      }

      resetGesture();
    };

    const handleTouchCancel = () => {
      touchSequenceActiveRef.current = false;
      if (activeGestureRef.current) {
        resetGesture();
      }
    };

    const handleScroll = () => {
      document.documentElement.toggleAttribute(PULL_TO_REFRESH_TOP_ATTRIBUTE, window.scrollY <= 0);

      if (activeGestureRef.current && window.scrollY > 0) {
        resetGesture();
      }
    };

    document.documentElement.toggleAttribute(PULL_TO_REFRESH_TOP_ATTRIBUTE, window.scrollY <= 0);

    const passiveListenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    const pointerMoveListenerOptions: AddEventListenerOptions = { capture: true, passive: false };
    const touchMoveListenerOptions: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener("pointerdown", handlePointerDown, passiveListenerOptions);
    window.addEventListener("pointermove", handlePointerMove, pointerMoveListenerOptions);
    window.addEventListener("pointerup", handlePointerUp, passiveListenerOptions);
    window.addEventListener("pointercancel", handlePointerCancel, passiveListenerOptions);
    window.addEventListener("touchstart", handleTouchStart, passiveListenerOptions);
    window.addEventListener("touchmove", handleTouchMove, touchMoveListenerOptions);
    window.addEventListener("touchend", handleTouchEnd, passiveListenerOptions);
    window.addEventListener("touchcancel", handleTouchCancel, passiveListenerOptions);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.documentElement.removeAttribute(PULL_TO_REFRESH_TOP_ATTRIBUTE);
      document.documentElement.removeAttribute("data-pull-to-refresh-active");
      document.documentElement.style.removeProperty("--pull-content-offset");
      window.removeEventListener("pointerdown", handlePointerDown, passiveListenerOptions);
      window.removeEventListener("pointermove", handlePointerMove, pointerMoveListenerOptions);
      window.removeEventListener("pointerup", handlePointerUp, passiveListenerOptions);
      window.removeEventListener("pointercancel", handlePointerCancel, passiveListenerOptions);
      window.removeEventListener("touchstart", handleTouchStart, passiveListenerOptions);
      window.removeEventListener("touchmove", handleTouchMove, touchMoveListenerOptions);
      window.removeEventListener("touchend", handleTouchEnd, passiveListenerOptions);
      window.removeEventListener("touchcancel", handleTouchCancel, passiveListenerOptions);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isVisible = phase !== "idle";

  return (
    <div
      aria-busy={phase === "refreshing"}
      aria-hidden={!isVisible}
      aria-live={isVisible ? "polite" : undefined}
      className="pull-to-refresh-indicator pointer-events-none z-[60] opacity-0 transition-opacity duration-150 data-[visible=true]:opacity-100"
      data-state={phase}
      data-visible={isVisible}
      role={isVisible ? "status" : undefined}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-background/95 shadow-lg">
        <span className="sr-only">{isVisible ? getIndicatorAccessibleLabel(phase) : ""}</span>
        <RefreshCw aria-hidden="true" className="size-5 text-primary motion-safe:animate-spin" />
      </div>
    </div>
  );
}
