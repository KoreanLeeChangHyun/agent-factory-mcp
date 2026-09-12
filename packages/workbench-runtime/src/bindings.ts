import type { Binding } from "@agent-factory/contracts";
import type { BindingClient, BindingOperation, RuntimeDiagnostic, RuntimeRecord, RuntimeScope } from "./contracts.js";
import { readStatePath, validateParameterValues } from "./validation.js";

export type BindingStatus = "idle" | "loading" | "ready" | "empty" | "stale" | "error";
export interface BindingSnapshot {
  status: BindingStatus;
  data?: RuntimeRecord;
  diagnostics: RuntimeDiagnostic[];
  error?: string;
}
interface CacheEntry {
  value: RuntimeRecord;
  expiresAt: number;
}
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
};

export class BindingRuntime {
  readonly #operations: Map<string, BindingOperation>;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #controllers = new Map<string, AbortController>();
  readonly #generations = new Map<string, number>();
  #epoch = 0;
  constructor(
    readonly client: BindingClient,
    operations: readonly BindingOperation[],
    readonly maxEntries = 64,
  ) {
    this.#operations = new Map(operations.map((operation) => [operation.id, operation]));
    if (this.#operations.size !== operations.length) throw new Error("binding operation IDs must be unique");
  }
  cancel(): void {
    this.#epoch += 1;
    for (const controller of this.#controllers.values()) controller.abort();
    this.#controllers.clear();
  }
  cancelBinding(bindingId: string): void {
    this.#generations.set(bindingId, (this.#generations.get(bindingId) ?? 0) + 1);
    this.#controllers.get(bindingId)?.abort();
    this.#controllers.delete(bindingId);
  }
  invalidate(): void {
    this.#cache.clear();
  }
  async load(
    binding: Binding,
    state: RuntimeRecord,
    scope: RuntimeScope,
    refresh = false,
    consumerId = binding.id,
  ): Promise<BindingSnapshot> {
    this.#controllers.get(consumerId)?.abort();
    const requestGeneration = (this.#generations.get(consumerId) ?? 0) + 1;
    this.#generations.set(consumerId, requestGeneration);
    const requestEpoch = this.#epoch;
    const operation = this.#operations.get(binding.source);
    if (!operation)
      return {
        status: "error",
        diagnostics: [
          { path: "$.source", code: "unknown-operation", message: `허용되지 않은 operation ${binding.source}입니다.` },
        ],
      };
    const input: RuntimeRecord = {};
    for (const mapping of binding.inputMappings) {
      const value = readStatePath(state, mapping.statePath);
      if (value !== undefined) input[mapping.input] = value;
    }
    const diagnostics = validateParameterValues(input, operation.inputs, "$.input");
    if (diagnostics.length) return { status: "error", diagnostics };
    const key = canonical({ ...scope, operationId: operation.id, input });
    const cached = this.#cache.get(key);
    if (!refresh && cached && cached.expiresAt > Date.now())
      return { status: "ready", data: cached.value, diagnostics: [] };
    const controller = new AbortController();
    this.#controllers.set(consumerId, controller);
    try {
      const output = await this.client.execute({ operationId: operation.id, input, scope, signal: controller.signal });
      if (
        controller.signal.aborted ||
        requestEpoch !== this.#epoch ||
        requestGeneration !== this.#generations.get(consumerId)
      )
        throw new DOMException("stale binding reply", "AbortError");
      const outputIssues = validateParameterValues(output, operation.outputs, "$.output");
      if (outputIssues.length)
        return { status: "error", diagnostics: outputIssues, error: "operation 응답 형식이 유효하지 않습니다." };
      if (binding.cacheSeconds && binding.cacheSeconds > 0) {
        this.#cache.set(key, { value: output, expiresAt: Date.now() + binding.cacheSeconds * 1000 });
        while (this.#cache.size > this.maxEntries) this.#cache.delete(this.#cache.keys().next().value!);
      }
      return { status: Object.keys(output).length ? "ready" : "empty", data: output, diagnostics: [] };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return {
        status: cached ? "stale" : "error",
        data: cached?.value,
        diagnostics: [],
        error: error instanceof Error ? error.message : "operation을 완료하지 못했습니다.",
      };
    } finally {
      if (this.#controllers.get(consumerId) === controller) this.#controllers.delete(consumerId);
    }
  }
}
