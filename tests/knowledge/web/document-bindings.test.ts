// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BindingRequest } from "@agent-factory/workbench-runtime";
import { createWorkbenchBindingClient } from "../../../apps/web/src/app/workbench-bindings.js";

const request = (operationId: string, input: BindingRequest["input"] = {}): BindingRequest => ({
  operationId,
  input,
  signal: new AbortController().signal,
  scope: {
    userId: "user",
    organizationId: "organization",
    workspaceId: "workspace",
    workbenchId: "documents",
    releaseId: "release",
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("document bindings composed for the shell", () => {
  it("uses the selected tenant and forwards cancellation when projecting document rows", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json([{ id: "document", title: "문서", document_type: "original" }]));
    vi.stubGlobal("fetch", fetch);
    const input = request("documents-list@1", { workspaceId: "another-workspace" });
    const result = await createWorkbenchBindingClient("organization", "workspace").execute(input);
    expect(result).toEqual({ records: [{ id: "document", label: "문서", meta: "original" }] });
    expect(fetch).toHaveBeenCalledWith(
      "/api/organizations/organization/workspaces/workspace/documents",
      expect.objectContaining({ signal: input.signal, credentials: "same-origin" }),
    );
  });

  it("reads the authoritative revision and bounds the rendered text", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "document", current_revision_number: 7 }))
      .mockResolvedValueOnce(new Response("가".repeat(3000)));
    vi.stubGlobal("fetch", fetch);
    const input = request("document-read@1", { documentId: "document" });
    await expect(createWorkbenchBindingClient("organization", "workspace").execute(input)).resolves.toEqual({
      value: "가".repeat(2048),
    });
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/organizations/organization/workspaces/workspace/documents/document/revisions/7/content",
      expect.objectContaining({ signal: input.signal }),
    );
  });

  it("does not request content for a document without a revision", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: "document", current_revision_number: 0 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      createWorkbenchBindingClient("organization", "workspace").execute(
        request("document-read@1", { documentId: "document" }),
      ),
    ).resolves.toEqual({ value: "내용이 없습니다." });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects an absent selection or an unregistered operation without network requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      createWorkbenchBindingClient("organization", null).execute(request("documents-list@1")),
    ).rejects.toThrow("작업공간을 먼저 선택");
    await expect(
      createWorkbenchBindingClient("organization", "workspace").execute(request("unknown@1")),
    ).rejects.toThrow("허용되지 않은 binding operation");
    expect(fetch).not.toHaveBeenCalled();
  });
});
