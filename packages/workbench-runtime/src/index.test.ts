import { describe, expect, it } from "vitest";
import { documentsFixture } from "@agent-factory/contracts";
import { summarizeWorkbench } from "./index.js";

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
});
