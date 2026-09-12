import type { AssetParameter } from "@agent-factory/contracts";
import type { BindingOperation } from "@agent-factory/workbench-runtime";

const records: NonNullable<AssetParameter["items"]> = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    label: { type: "string", minLength: 1, maxLength: 80 },
    meta: { type: "string", maxLength: 80 },
    parentId: { type: "string", maxLength: 64 },
  },
};

export const documentOperations: readonly BindingOperation[] = [
  {
    id: "documents-list@1",
    inputs: [{ name: "workspaceId", type: "string", required: true, maxLength: 64 }],
    outputs: [{ name: "records", type: "record-list", required: true, maxItems: 100, items: records, uniqueBy: "id" }],
  },
  {
    id: "document-read@1",
    inputs: [{ name: "documentId", type: "string", required: true, maxLength: 64 }],
    outputs: [{ name: "value", type: "string", required: true, maxLength: 2048 }],
  },
];
