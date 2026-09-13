import type { BindingClient, RuntimeRecord } from "@agent-factory/workbench-runtime";
import { documentClient } from "./document-client.js";

export function createDocumentBindingClient(organizationId: string | null, workspaceId: string | null): BindingClient {
  return {
    async execute({ operationId, input, signal }): Promise<RuntimeRecord> {
      if (!organizationId || !workspaceId) throw new Error("작업공간을 먼저 선택해 주세요.");
      if (operationId === "documents-list@1") {
        const rows = await documentClient.list(organizationId, workspaceId, signal);
        const records: RuntimeRecord[] = rows.map((row) => ({
          id: row.id,
          label: row.title,
          meta: row.document_type,
        }));
        return { records };
      }
      if (operationId === "document-read@1") {
        const row = await documentClient.get(organizationId, workspaceId, String(input.documentId), signal);
        if (!row.current_revision_number) return { value: "내용이 없습니다." };
        const result = await documentClient.content(
          organizationId,
          workspaceId,
          row.id,
          row.current_revision_number,
          signal,
        );
        return { value: (await result.blob.text()).slice(0, 2048) };
      }
      throw new Error("허용되지 않은 binding operation입니다.");
    },
  };
}
