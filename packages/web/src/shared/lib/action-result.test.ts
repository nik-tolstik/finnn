import { describe, expect, it } from "vitest";

import { fail, getErrorMessage, ok, success } from "./action-result";

describe("action-result helpers", () => {
  it("keeps compatible data shape", () => {
    expect(ok({ id: "1" })).toEqual({ data: { id: "1" } });
  });

  it("keeps compatible success shape with optional extra data", () => {
    expect(success()).toEqual({ success: true });
    expect(success({ userId: "user-1" })).toEqual({ success: true, userId: "user-1" });
  });

  it("uses Error messages before fallback messages", () => {
    expect(fail(new Error("Boom"), "Fallback")).toEqual({ error: "Boom" });
    expect(getErrorMessage(new Error("Boom"), "Fallback")).toBe("Boom");
  });

  it("uses fallback for unknown or empty errors", () => {
    expect(fail("bad", "Fallback")).toEqual({ error: "Fallback" });
    expect(getErrorMessage(new Error(""), "Fallback")).toBe("Fallback");
  });
});
