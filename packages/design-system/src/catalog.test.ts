import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validate } from "@agent-factory/contracts";
import {
  assetCatalog,
  implementationIds,
  implementationPropertyNames,
  instantiateAsset,
  invokeAssetAction,
} from "./catalog.js";

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
  it("binds every descriptor to exactly one real implementation", () => {
    expect(implementationIds().sort()).toEqual(assetCatalog.map((asset) => asset.id).sort());
    for (const asset of assetCatalog) {
      expect(instantiateAsset(asset.id, asset.example)).toBeTruthy();
      expect(implementationPropertyNames(asset.id)).toEqual(asset.properties.map((property) => property.name).sort());
      expect(
        Object.keys(asset.example).every((name) => asset.properties.some((property) => property.name === name)),
      ).toBe(true);
    }
    expect(assetCatalog.find((asset) => asset.id === "tree@1")?.actions).toEqual(["select"]);
    expect(assetCatalog.find((asset) => asset.id === "toggle@1")?.outputs.map((item) => item.name)).toEqual(["value"]);
    expect(assetCatalog.find((asset) => asset.id === "resource-header@1")).toMatchObject({
      actions: ["refresh"],
      outputs: [],
    });
    expect(assetCatalog.find((asset) => asset.id === "chart-frame@1")?.actions).toEqual([]);
  });
  it("keeps the checked-in split descriptor equal to the registry contract", () => {
    const checkedIn = JSON.parse(
      readFileSync(new URL("../../../contracts/examples/catalog/panel-split.json", import.meta.url), "utf8"),
    );
    expect(checkedIn).toEqual(assetCatalog.find((asset) => asset.id === "split@1"));
  });
  it("rejects missing IDs and unsupported properties", () => {
    expect(() => instantiateAsset("missing@1")).toThrow(/No implementation/);
    expect(() => instantiateAsset("button@1", { rawCss: "display:none" })).toThrow(/Unsupported/);
    expect(() => instantiateAsset("documents@1", {})).toThrow(/Missing required/);
    expect(() => instantiateAsset("button@1", { disabled: "yes" })).toThrow(/Invalid boolean/);
    expect(() => instantiateAsset("toggle@1", {}, { inputs: { unknown: true } })).toThrow(/Unsupported input/);
    expect(() =>
      instantiateAsset("collection@1", {}, { inputs: { slots: [{ id: "a", title: "A", rawHtml: "<b>A</b>" }] } }),
    ).toThrow(/Unsupported input item field/);
    expect(() =>
      instantiateAsset(
        "collection@1",
        {},
        {
          inputs: {
            slots: [
              { id: "a", title: "A" },
              { id: "a", title: "B" },
            ],
          },
        },
      ),
    ).toThrow(/Duplicate input item/);
    expect(() => invokeAssetAction("toggle@1", "submit", {})).toThrow(/Unsupported action/);
    expect(() => invokeAssetAction("toggle@1", "toggle", { value: "yes" })).toThrow(/Invalid boolean output/);
  });

  it("dispatches every advertised action with its closed output contract", () => {
    for (const asset of assetCatalog.filter((candidate) => candidate.actions.length)) {
      const output = Object.fromEntries(
        asset.outputs.map((parameter) => [
          parameter.name,
          parameter.type === "number" || parameter.type === "integer"
            ? 1
            : parameter.type === "boolean"
              ? true
              : parameter.type === "string-list"
                ? ["example"]
                : parameter.type === "record-list"
                  ? [{ id: "example" }]
                  : "example",
        ]),
      );
      const events: unknown[] = [];
      for (const action of asset.actions)
        invokeAssetAction(asset.id, action, output, { onAction: (event) => events.push(event) });
      expect(events).toHaveLength(asset.actions.length);
    }
    expect(() => invokeAssetAction("chart-frame@1", "select", {})).toThrow(/Unsupported action/);
  });
});
