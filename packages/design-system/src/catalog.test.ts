import { describe, expect, it } from "vitest";
import { validate } from "@agent-factory/contracts";
import { assetCatalog } from "./catalog.js";

describe("asset catalog", () => {
  it("has unique versioned IDs and contract-valid descriptors", () => {
    expect(new Set(assetCatalog.map((asset) => asset.id)).size).toBe(assetCatalog.length);
    for (const asset of assetCatalog) {
      expect(() => validate(asset, "schemas/catalog/v1/asset-descriptor.schema.json")).not.toThrow();
    }
  });
  it("covers broad initial sidebar and panel variants", () => {
    expect(assetCatalog.filter((asset) => asset.kind === "sidebar").length).toBeGreaterThanOrEqual(6);
    expect(assetCatalog.filter((asset) => asset.kind === "panel").length).toBeGreaterThanOrEqual(9);
  });
});
