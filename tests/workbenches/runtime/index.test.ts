import { describe, expect, it } from "vitest";
import { documentsFixture } from "@agent-factory/contracts";
import { renderRegisteredAsset, summarizeWorkbench } from "../../../packages/workbench-runtime/src/index.js";

describe("Workbench runtime", () => {
  it("interprets the shared Documents fixture", () => {
    expect(summarizeWorkbench(documentsFixture)).toEqual({
      id: "documents",
      title: "문서",
      sidebar: "문서 탐색기",
      panel: "문서 패널",
      componentCount: 3,
    });
  });
  it("instantiates registered assets and rejects undeclared IDs", () => {
    expect(renderRegisteredAsset("button@1", { label: "저장" })).toBeTruthy();
    expect(() => renderRegisteredAsset("unknown@1")).toThrow(/not declared/);
  });
});
