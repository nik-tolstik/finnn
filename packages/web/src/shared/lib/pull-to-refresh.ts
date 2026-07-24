export const PULL_TO_REFRESH_THRESHOLD_PX = 120;

const PULL_TO_REFRESH_CONTENT_MAX_OFFSET_PX = 64;
const PULL_TO_REFRESH_CONTENT_RESISTANCE = 0.5;
const INTERACTIVE_TARGET_SELECTOR =
  'a, button, input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="button"]';
const MODAL_TARGET_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [data-slot="dialog-overlay"], [data-slot="sheet-overlay"]';

export type PullToRefreshPhase = "idle" | "pulling" | "ready" | "refreshing";

interface PullToRefreshStartInput {
  isPrimary: boolean;
  pointerType: string;
  scrollY: number;
  targetIgnored: boolean;
}

interface PullToRefreshMoveInput {
  currentX: number;
  currentY: number;
  scrollY: number;
  startX: number;
  startY: number;
}

interface PullToRefreshMoveResult {
  distance: number;
  phase: "pulling" | "ready";
}

export function canStartPullToRefresh({
  isPrimary,
  pointerType,
  scrollY,
  targetIgnored,
}: PullToRefreshStartInput): boolean {
  return pointerType === "touch" && isPrimary && scrollY <= 0 && !targetIgnored;
}

export function isPredominantlyVerticalPull(deltaX: number, deltaY: number): boolean {
  return deltaY > 0 && deltaY >= Math.abs(deltaX);
}

export function getPullToRefreshMoveState({
  currentX,
  currentY,
  scrollY,
  startX,
  startY,
}: PullToRefreshMoveInput): PullToRefreshMoveResult | null {
  if (scrollY > 0) {
    return null;
  }

  const deltaX = currentX - startX;
  const deltaY = currentY - startY;

  if (!isPredominantlyVerticalPull(deltaX, deltaY)) {
    return null;
  }

  return {
    distance: deltaY,
    phase: deltaY >= PULL_TO_REFRESH_THRESHOLD_PX ? "ready" : "pulling",
  };
}

export function getPullToRefreshContentOffset(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) {
    return 0;
  }

  return Math.min(distance * PULL_TO_REFRESH_CONTENT_RESISTANCE, PULL_TO_REFRESH_CONTENT_MAX_OFFSET_PX);
}

export function shouldReloadOnPullToRefreshRelease(phase: PullToRefreshPhase): boolean {
  return phase === "ready";
}

export function shouldIgnorePullToRefreshTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return true;
  }

  if (target.closest(`${INTERACTIVE_TARGET_SELECTOR}, ${MODAL_TARGET_SELECTOR}`)) {
    return true;
  }

  let current: Element | null = target;
  while (current && current !== document.body) {
    const { overflowY } = getComputedStyle(current);
    const isScrollable = ["auto", "overlay", "scroll"].includes(overflowY);

    if (isScrollable && current.scrollHeight > current.clientHeight) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}
