import { describe, expect, it } from "vitest";
import type { Binding } from "@agent-factory/contracts";
import { BindingRuntime } from "../../../packages/workbench-runtime/src/bindings.js";
import type { BindingClient, BindingOperation, RuntimeRecord, RuntimeScope } from "../../../packages/workbench-runtime/src/contracts.js";

const binding: Binding = {
  id: "document",
  source: "document-read@1",
  inputMappings: [{ input: "documentId", statePath: "selection.id" }],
  cacheSeconds: 30,
};
const operation: BindingOperation = {
  id: "document-read@1",
  inputs: [{ name: "documentId", type: "string", required: true, maxLength: 64 }],
  outputs: [{ name: "value", type: "string", required: true, maxLength: 80 }],
};
const scope = (workspaceId: string): RuntimeScope => ({
  userId: "user",
  organizationId: "organization",
  workspaceId,
  workbenchId: "documents",
  releaseId: "release-1",
});

describe("binding runtime", () => {
  it("discards stale A to B to A replies even when transport ignores abort", async () => {
    const pending: ((value: RuntimeRecord) => void)[] = [];
    const client: BindingClient = { execute: () => new Promise((resolve) => pending.push(resolve)) };
    const runtime = new BindingRuntime(client, [operation]);
    const first = runtime.load(binding, { selection: { id: "a" } }, scope("one"));
    const second = runtime.load(binding, { selection: { id: "b" } }, scope("one"));
    const third = runtime.load(binding, { selection: { id: "a" } }, scope("one"));
    pending[2]!({ value: "new a" });
    await expect(third).resolves.toMatchObject({ status: "ready", data: { value: "new a" } });
    pending[1]!({ value: "b" });
    pending[0]!({ value: "old a" });
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
  });

  it("isolates cache by full context and rejects malformed outputs and unsafe inputs", async () => {
    let calls = 0;
    const client: BindingClient = {
      execute: async () => {
        calls += 1;
        return { value: "content" };
      },
    };
    const runtime = new BindingRuntime(client, [operation], 2);
    await runtime.load(binding, { selection: { id: "a" } }, scope("one"));
    await runtime.load(binding, { selection: { id: "a" } }, scope("one"));
    await runtime.load(binding, { selection: { id: "a" } }, scope("two"));
    expect(calls).toBe(2);
    const unsafe = { ...binding, inputMappings: [{ input: "url", statePath: "selection.id" }] };
    await expect(
      runtime.load(unsafe, { selection: { id: "https://unsafe.test" } }, scope("one")),
    ).resolves.toMatchObject({
      status: "error",
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "unknown-field" })]),
    });
    const malformed = new BindingRuntime({ execute: async () => ({ value: 4 }) }, [operation]);
    await expect(
      malformed.load({ ...binding, cacheSeconds: 0 }, { selection: { id: "a" } }, scope("one")),
    ).resolves.toMatchObject({ status: "error", error: expect.stringContaining("응답 형식") });
  });

  it("invalidates stale replies on context switch and consumer unmount", async () => {
    const pending: ((value: RuntimeRecord) => void)[] = [];
    const runtime = new BindingRuntime({ execute: () => new Promise((resolve) => pending.push(resolve)) }, [operation]);
    const beforeSwitch = runtime.load(binding, { selection: { id: "a" } }, scope("one"), false, "tree");
    const afterSwitch = runtime.load(binding, { selection: { id: "a" } }, scope("two"), false, "tree");
    pending[0]!({ value: "old workspace" });
    await expect(beforeSwitch).rejects.toMatchObject({ name: "AbortError" });
    runtime.cancelBinding("tree");
    pending[1]!({ value: "unmounted" });
    await expect(afterSwitch).rejects.toMatchObject({ name: "AbortError" });
  });
});
