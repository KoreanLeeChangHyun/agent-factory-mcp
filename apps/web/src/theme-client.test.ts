// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readCachedTheme, writeCachedTheme } from "./theme-client.js";

const context = { userId: "01234567-89ab-cdef-0123-456789abcdef", organizationId: "org", workspaceId: "work" };
const profile = {
  schemaVersion: "1.0" as const,
  userId: "0123456789abcdef0123456789abcdef",
  revision: 1,
  base: "dark" as const,
  density: "compact" as const,
  overrides: {},
  reducedMotion: false,
};

describe("theme cache", () => {
  beforeEach(() => localStorage.clear());
  it("is context scoped and validates ownership", () => {
    writeCachedTheme(context, profile);
    expect(readCachedTheme(context)).toEqual(profile);
    expect(readCachedTheme({ ...context, userId: "11234567-89ab-cdef-0123-456789abcdef" })).toBeNull();
  });
});
