import { describe, expect, it } from "vitest";

import {
  canStartPullToRefresh,
  getPullToRefreshContentOffset,
  getPullToRefreshMoveState,
  isPredominantlyVerticalPull,
  shouldIgnorePullToRefreshTarget,
  shouldReloadOnPullToRefreshRelease,
} from "./pull-to-refresh";

describe("pull-to-refresh gesture logic", () => {
  it("starts only for a primary touch pointer at the top of the page", () => {
    expect(
      canStartPullToRefresh({
        isPrimary: true,
        pointerType: "touch",
        scrollY: 0,
        targetIgnored: false,
      })
    ).toBe(true);

    expect(
      canStartPullToRefresh({
        isPrimary: true,
        pointerType: "mouse",
        scrollY: 0,
        targetIgnored: false,
      })
    ).toBe(false);

    expect(
      canStartPullToRefresh({
        isPrimary: false,
        pointerType: "touch",
        scrollY: 0,
        targetIgnored: false,
      })
    ).toBe(false);

    expect(
      canStartPullToRefresh({
        isPrimary: true,
        pointerType: "touch",
        scrollY: 1,
        targetIgnored: false,
      })
    ).toBe(false);
  });

  it("ignores interactive, modal, and unavailable targets", () => {
    expect(
      canStartPullToRefresh({
        isPrimary: true,
        pointerType: "touch",
        scrollY: 0,
        targetIgnored: true,
      })
    ).toBe(false);
    expect(shouldIgnorePullToRefreshTarget(null)).toBe(true);
  });

  it("accepts downward predominantly vertical movement and cancels other directions", () => {
    expect(isPredominantlyVerticalPull(12, 24)).toBe(true);
    expect(isPredominantlyVerticalPull(24, 12)).toBe(false);
    expect(isPredominantlyVerticalPull(0, -24)).toBe(false);

    expect(
      getPullToRefreshMoveState({
        currentX: 108,
        currentY: 124,
        scrollY: 0,
        startX: 100,
        startY: 100,
      })
    ).toMatchObject({ phase: "pulling", distance: 24 });

    expect(
      getPullToRefreshMoveState({
        currentX: 130,
        currentY: 118,
        scrollY: 0,
        startX: 100,
        startY: 100,
      })
    ).toBeNull();

    expect(
      getPullToRefreshMoveState({
        currentX: 100,
        currentY: 200,
        scrollY: 2,
        startX: 100,
        startY: 100,
      })
    ).toBeNull();
  });

  it("applies resistance to the content offset", () => {
    expect(getPullToRefreshContentOffset(40)).toBe(20);
    expect(getPullToRefreshContentOffset(160)).toBe(64);
    expect(getPullToRefreshContentOffset(-10)).toBe(0);
  });

  it("enters the ready phase only after the release threshold", () => {
    expect(
      getPullToRefreshMoveState({
        currentX: 100,
        currentY: 219,
        scrollY: 0,
        startX: 100,
        startY: 100,
      })
    ).toMatchObject({ phase: "pulling", distance: 119 });

    expect(
      getPullToRefreshMoveState({
        currentX: 100,
        currentY: 220,
        scrollY: 0,
        startX: 100,
        startY: 100,
      })
    ).toMatchObject({ phase: "ready", distance: 120 });
  });

  it("reloads only when releasing from the ready phase", () => {
    expect(shouldReloadOnPullToRefreshRelease("pulling")).toBe(false);
    expect(shouldReloadOnPullToRefreshRelease("idle")).toBe(false);
    expect(shouldReloadOnPullToRefreshRelease("ready")).toBe(true);
    expect(shouldReloadOnPullToRefreshRelease("refreshing")).toBe(false);
  });
});
