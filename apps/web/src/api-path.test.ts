import { describe, expect, it } from "vitest";
import { apiPath, applicationRoot } from "./api-path.js";

describe("production root path", () => {
  it("derives the configured proxy prefix from shadow routes and deep links", () => {
    expect(applicationRoot("/workbench/")).toBe("");
    expect(applicationRoot("/factory/workbench/documents/example")).toBe("/factory");
  });

  it("is safe without a browser global and permits explicit root injection", () => {
    expect(applicationRoot()).toBe("");
    expect(apiPath("/api/auth/me", "/factory/workbench/")).toBe("/factory/api/auth/me");
  });
});
