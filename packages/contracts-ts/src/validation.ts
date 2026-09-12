import type { ErrorObject } from "ajv";
import { contractLimits } from "./generated/schema-bundle.js";
import { validators } from "./generated/validators.js";

export const limits = contractLimits as {
  maxBytes: number;
  maxDepth: number;
  maxNodes: number;
  maxStringLength: number;
  maxValidationMilliseconds: number;
};

export class ContractValidationError extends Error {}

function measure(value: unknown, depth = 1): number {
  if (depth > limits.maxDepth) throw new ContractValidationError("document exceeds maximum depth");
  if (typeof value === "string" && value.length > limits.maxStringLength)
    throw new ContractValidationError("document contains an oversized string");
  if (Array.isArray(value)) return 1 + value.reduce((total, item) => total + measure(item, depth + 1), 0);
  if (value !== null && typeof value === "object")
    return 1 + Object.values(value).reduce<number>((total, item) => total + measure(item, depth + 1), 0);
  return 1;
}

export function validate(document: unknown, schemaPath = "schemas/workbench/v1/definition.schema.json"): void {
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > limits.maxBytes)
    throw new ContractValidationError("document exceeds maximum byte size");
  if (measure(document) > limits.maxNodes) throw new ContractValidationError("document exceeds maximum node count");
  const validator = validators[schemaPath];
  if (!validator) throw new ContractValidationError(`unknown schema: ${schemaPath}`);
  const started = performance.now();
  const valid = validator(document);
  if (performance.now() - started > limits.maxValidationMilliseconds)
    throw new ContractValidationError("validation exceeded execution bound");
  if (!valid) {
    const first = (validator.errors as ErrorObject[] | null)?.[0];
    throw new ContractValidationError(`${first?.instancePath || "$"}: ${first?.message || "invalid document"}`);
  }
}
