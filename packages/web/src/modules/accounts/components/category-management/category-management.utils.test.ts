import { describe, expect, it } from "vitest";

import { createCategoryUpdateQueue, resolveInlineCategoryNameEdit } from "./category-management.utils";

function createDeferred() {
  let complete: (() => void) | undefined;
  const promise = new Promise<void>((resolvePromise) => {
    complete = resolvePromise;
  });

  return {
    promise,
    resolve: () => complete?.(),
  };
}

describe("resolveInlineCategoryNameEdit", () => {
  it("does not commit a draft cancelled with Escape", () => {
    expect(
      resolveInlineCategoryNameEdit({
        categoryName: "Продукты",
        draftName: "Супермаркет",
        wasCancelled: true,
      })
    ).toEqual({ nextName: null, shouldReset: true });
  });

  it("trims a committed name and leaves an unchanged name alone", () => {
    expect(
      resolveInlineCategoryNameEdit({
        categoryName: "Продукты",
        draftName: "  Супермаркет  ",
        wasCancelled: false,
      })
    ).toEqual({ nextName: "Супермаркет", shouldReset: false });

    expect(
      resolveInlineCategoryNameEdit({
        categoryName: "Продукты",
        draftName: "Продукты",
        wasCancelled: false,
      })
    ).toEqual({ nextName: null, shouldReset: false });
  });
});

describe("createCategoryUpdateQueue", () => {
  it("runs updates for the same category in request order", async () => {
    const queueCategoryUpdate = createCategoryUpdateQueue();
    const firstUpdateGate = createDeferred();
    const calls: string[] = [];

    const firstUpdate = queueCategoryUpdate("category-1", async () => {
      calls.push("first-start");
      await firstUpdateGate.promise;
      calls.push("first-finish");
    });
    const secondUpdate = queueCategoryUpdate("category-1", async () => {
      calls.push("second");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["first-start"]);

    firstUpdateGate.resolve();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(calls).toEqual(["first-start", "first-finish", "second"]);
  });

  it("continues with a newer update after an earlier one fails", async () => {
    const queueCategoryUpdate = createCategoryUpdateQueue();
    const calls: string[] = [];

    const failedUpdate = queueCategoryUpdate("category-1", async () => {
      calls.push("failed");
      throw new Error("Request failed");
    });
    const newerUpdate = queueCategoryUpdate("category-1", async () => {
      calls.push("newer");
    });

    await expect(failedUpdate).rejects.toThrow("Request failed");
    await expect(newerUpdate).resolves.toBeUndefined();

    expect(calls).toEqual(["failed", "newer"]);
  });
});
