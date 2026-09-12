import { describe, expect, it } from "vitest";
import type { AssetDescriptor, ThemeProfile } from "./generated/types.js";

const asset = {
  id: "resource-table@1",
  kind: "display",
  allowedRegions: ["panel"],
  properties: [
    { name: "mode", type: "string", required: true, maxLength: 80, enum: ["compact"] },
    { name: "rows", type: "record-list", required: true, maxItems: 1000 },
    { name: "tags", type: "string-list", required: false, maxItems: 32 },
    { name: "count", type: "integer", required: false },
    { name: "ratio", type: "number", required: false },
    { name: "enabled", type: "boolean", required: false },
  ],
  inputs: [],
  outputs: [],
  states: ["loading", "empty", "ready", "stale", "error", "permission-denied", "disabled"],
  actions: ["select", "refresh", "submit", "navigate-internal", "toggle", "dismiss"],
  accessibility: { role: "table", keyboard: "Native table semantics.", live: "polite" },
  provenance: { source: "type fixture", license: "Project-owned" },
  example: { label: "Resources", compact: true },
} satisfies AssetDescriptor;

const theme = {
  schemaVersion: "1.0",
  userId: "0123456789abcdef0123456789abcdef",
  revision: 1,
  base: "high-contrast",
  density: "comfortable",
  overrides: { accent: "#4C9AFF", focus: "#79B8FF", surface: "#11151B", text: "#FFFFFF" },
  reducedMotion: true,
} satisfies ThemeProfile;

describe("generated types", () => {
  it("represent every bounded catalog parameter and nested contract field", () => {
    expect(asset.properties).toHaveLength(6);
    expect(theme.overrides.text).toBe("#FFFFFF");
  });
});
