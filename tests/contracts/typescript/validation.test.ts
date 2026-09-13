import { describe, expect, it } from "vitest";
import { ContractValidationError, validate } from "../../../packages/contracts-ts/src/validation.js";
import { documentsFixture } from "../../../packages/contracts-ts/src/generated/schema-bundle.js";

describe("contract validator", () => {
  it("accepts the generated Documents fixture", () => expect(() => validate(documentsFixture)).not.toThrow());
  it("rejects unregistered properties", () => {
    const value = structuredClone(documentsFixture);
    value.panel.components[0].props = { rawCss: "body{}" };
    expect(() => validate(value)).toThrow(ContractValidationError);
  });
});
